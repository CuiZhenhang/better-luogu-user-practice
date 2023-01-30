// ==UserScript==
// @name         更好的洛谷用户练习情况
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  功能：显示题目难度；按题目难度和编号排序；快捷查看用户评测记录；另外，全局变量 window.__betterLuoguUserPractice_costTime 反映了本插件运行时间，将 window.__betterLuoguUserPractice_sortByDifficulty 设置为 false 可临时取消按难度排序。
// @author       CuiZhenhang
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

    function updateProblems () {
        if (window.location.pathname === pathname) return false
        if (!window.location.pathname.endsWith(window._feInstance?.currentData?.user?.uid)) return true
        pathname = window.location.pathname
        for (let passed of window._feInstance.currentData.passedProblems) problems[passed.pid] = { dif: passed.difficulty, rendered: false }
        for (let tryed of window._feInstance.currentData.submittedProblems) problems[tryed.pid] = { dif: tryed.difficulty, rendered: false }
        return false
    }

    function setColor () {
        if (window.location.hash !== '#practice') {
            for (let pid in problems) {
                problems[pid].rendered = false
            }
            return
        }
        let allRendered = true
        for (let pid in problems) {
            if (!problems[pid].rendered) {
                allRendered = false
                break
            }
        }
        if (allRendered) return
        for (let el of document.querySelectorAll('div.problems a')) {
            let pid = el.textContent
            if (problems[pid].rendered) continue
            problems[pid].rendered = true
            el.style.color = colors[problems[pid].dif];
        }
    }

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
        if (window.location.pathname.startsWith('/user/')) {
            if (!updateProblems()) {
                setColor()
                sortProblems()
            }
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