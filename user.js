// ==UserScript==
// @name         更好的洛谷用户练习情况
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  功能：显示难易度统计条形图；显示题目难度；按题目难度和编号排序；快捷查看用户评测记录；另外，全局变量 window.__betterLuoguUserPractice_costTime 反映了本插件运行时间，将 window.__betterLuoguUserPractice_sortByDifficulty 设置为 false 可临时取消按难度排序。
// @author       CuiZhenhang
// @homepage     https://github.com/CuiZhenhang/better-luogu-user-practice
// @match        https://www.luogu.com.cn/*
// @icon         https://www.luogu.com.cn/favicon.ico
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    let colors = [
        'rgb(191, 191, 191)',
        'rgb(254, 76, 97)',
        'rgb(243, 156, 17)',
        'rgb(255, 193, 22)',
        'rgb(82, 196, 26)',
        'rgb(52, 152, 219)',
        'rgb(157, 61, 207)',
        'rgb(14, 29, 105)'
    ]
    let pathname = ''
    let problems = {}
    let partRendered = false

    function updateProblems () {
        if (window.location.pathname === pathname) return false
        if (!window.location.pathname.endsWith(window._feInstance?.currentData?.user?.uid)) return true
        pathname = window.location.pathname
        problems = {}
        for (let passed of window._feInstance.currentData.passedProblems) problems[passed.pid] = { dif: passed.difficulty, rendered: false }
        for (let tryed of window._feInstance.currentData.submittedProblems) problems[tryed.pid] = { dif: tryed.difficulty, rendered: false }
        return false
    }

    function renderColor () {
        if (window.location.hash !== '#practice') {
            if (partRendered) {
                for (let pid in problems) {
                    problems[pid].rendered = false
                }
                partRendered = false
            }
            return
        }
        if (partRendered) {
            let rendered = true
            for (let pid in problems) {
                if (!problems[pid].rendered) {
                    rendered = false
                    break
                }
            }
            if (rendered) return
        }
        for (let el of document.querySelectorAll('div.problems a')) {
            let pid = el.textContent
            if (problems[pid].rendered) continue
            problems[pid].rendered = true
            partRendered = true
            el.style.color = colors[problems[pid].dif];
        }
    }

    function renderChart () {
        if (window.location.hash !== '#practice') return
        let elDivList = document.querySelectorAll('div.difficulty-tags > div')
        let maxCount = 0
        let widthPerCount = Infinity
        for (let elDiv of elDivList) {
            let elText = elDiv.querySelector('span.problem-count')
            let count = Number((/\d+/.exec(elText?.textContent || '') || [])[0])
            if (count > maxCount) maxCount = count
            let elCaption = elDiv.querySelector('span.lfe-caption')
            let width = (elDiv?.offsetWidth - elCaption?.offsetWidth) * 0.8
            widthPerCount = Math.min(widthPerCount, width / count)
        }
        maxCount = Math.ceil((maxCount + 1) / 100) * 100
        if (widthPerCount < 0) widthPerCount = 0
        for (let elDiv of elDivList) {
            let elText = elDiv.querySelector('span.problem-count')
            if (!elText) continue
            let count = Number((/\d+/.exec(elText?.textContent || '') || [])[0])
            let width = Math.round(widthPerCount * count)
            if (elDiv.__betterLuoguUserPractice_width === width) continue
            elDiv.__betterLuoguUserPractice_width = width
            let elChart = elDiv.querySelector('div.__blup_chart')
            if (!elChart) {
                elChart = document.createElement('div')
                elChart.classList.add('__blup_chart')
                elChart.style.backgroundColor = elDiv.querySelector('span.lfe-caption')?.style?.backgroundColor
                elChart.style.position = 'absolute'
                elChart.style.right = '0'
                elChart.style.height = '50%'
                elText.style.zIndex = '1'
                elText.style.textShadow = '#ffffffc0 1px 0 0, #ffffffc0 0 1px 0, #ffffffc0 -1px 0 0, #ffffffc0 0 -1px 0'
                elDiv.style.position = 'relative'
                elDiv.appendChild(elChart)
            }
            let halfHeight = elChart.clientHeight / 2
            elChart.style.width = `${ width }px`
            elChart.style.borderTopLeftRadius = `${ halfHeight }px`
            elChart.style.borderBottomLeftRadius = `${ halfHeight }px`
        }
    }

    window.addEventListener('resize', function () {
        renderChart()
    })

    window.__betterLuoguUserPractice_sortByDifficulty = true

    function sortProblemsCompare (elA, elB) {
        let aPid = elA.textContent, bPid = elB.textContent
        if (window.__betterLuoguUserPractice_sortByDifficulty && problems[aPid].dif != problems[bPid].dif) {
            if (problems[aPid].dif < problems[bPid].dif) return -1
            return 1
        }
        if (aPid < bPid) return -1
        if (aPid > bPid) return 1
        return 0
    }

    function sortProblems () {
        if (window.location.hash !== '#practice') return
        for (let elDiv of document.querySelectorAll('div.problems')) {
            let sortedCode = window.__betterLuoguUserPractice_sortByDifficulty ? 1 : 2
            if (elDiv.__betterLuoguUserPractice_sortedCode === sortedCode) continue
            elDiv.__betterLuoguUserPractice_sortedCode = sortedCode
            let childNodes = elDiv.childNodes
            let sorted = true
            for (let i = 1; i < childNodes.length; ++i) {
                if (sortProblemsCompare(childNodes[i - 1], childNodes[i]) > 0) {
                    sorted = false
                    break
                }
            }
            if (sorted) continue
            let nodes = Array.from(childNodes).sort(sortProblemsCompare)
            elDiv.innerHTML = ''
            for (let el of nodes) {
                elDiv.appendChild(el)
            }
        }
    }

    function main () {
        if (window.location.pathname.startsWith('/user/') && !updateProblems()) {
            renderColor()
            renderChart()
            sortProblems()
        } else if (partRendered) {
            for (let pid in problems) {
                problems[pid].rendered = false
            }
            partRendered = false
        }
        if (window.location.pathname.startsWith('/user/') && window.location.hash === '#practice') {
            let uid = window._feInstance?.currentData?.user?.uid
            if (typeof uid === 'number') {
                for (let elH3 of document.querySelectorAll('h3')) {
                    if (elH3.textContent.includes('尝试过的题目')) {
                        let el = elH3.querySelector('a')
                        let href = `/record/list?user=${ uid }`
                        if (el === null) {
                            el = document.createElement('a')
                            el.href = href
                            el.title = '查看所有评测记录'
                            el.innerHTML = elH3.innerHTML
                            elH3.innerHTML = ''
                            elH3.appendChild(el)
                        } else if (el.href !== href) {
                            el.href = href
                        }
                    }
                }
            }
        }
        if (window.location.pathname.startsWith('/record/list')) {
            let records = window._feInstance?.currentData?.records?.result
            if (Array.isArray(records)) {
                let elList = Array.from(document.querySelectorAll('span.pid')).map((el) => el.parentNode)
                for (let index = 0; index < elList.length; ++index) {
                    let dif = records[index]?.problem?.difficulty
                    if (typeof dif !== 'number') continue
                    let el = elList[index]
                    if (el.style.color !== colors[dif]) el.style.color = colors[dif]
                }
            }
        }
        if (window.location.pathname.match(/\/record\/\d+/)) {
            let dif = window._feInstance?.currentData?.record?.problem?.difficulty
            if (typeof dif === 'number') {
                let color = colors[dif]
                for (let elSpan of document.querySelectorAll('span.pid')) {
                    let el = elSpan.parentNode
                    if (el.style.color !== color) el.style.color = color
                }
            }
        }
    }

    let costTime = {
        total: 0,
        max: 0,
        latest: 0
    }
    window.__betterLuoguUserPractice_costTime = costTime

    setInterval(() => {
        let start = Date.now()
        main()
        let cost = Date.now() - start
        costTime.latest = cost
        costTime.total += cost
        if (cost > costTime.max) costTime.max = cost
    }, 1000)
})();