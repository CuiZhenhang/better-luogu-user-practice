// ==UserScript==
// @name         更好的洛谷用户练习情况 v2
// @namespace    http://tampermonkey.net/
// @version      2.1.0 alpha
// @description  功能：显示难易度统计条形图；显示题目难度；按题目难度和编号排序；快捷查看用户评测记录；
// @author       CuiZhenhang
// @homepage     https://github.com/CuiZhenhang/better-luogu-user-practice
// @match        https://www.luogu.com.cn/*
// @match        https://www.luogu.com/*
// @icon         https://www.luogu.com.cn/favicon.ico
// @grant        none
// ==/UserScript==

/**
 * @typedef {Object} Problem
 * @property {string} type - The type of the problem.
 * @property {string} pid - The ID of the problem.
 * @property {string} title - The title of the problem.
 * @property {number} difficulty - The difficulty level of the problem.
 */

/**
 * @typedef {Object} UserInfo
 * @property {number} uid - The user ID.
 * @property {string} avatar - The URL of the user's avatar.
 * @property {string} name - The name of the user.
 * @property {string} slogan - The user's slogan.
 * @property {string|null} badge - The user's badge.
 * @property {boolean} isAdmin - Whether the user is an admin.
 * @property {boolean} isBanned - Whether the user is banned.
 * @property {string} color - The user's color. (e.g. "Green")
 * @property {number} ccfLevel - The user's CCF level.
 * @property {number} xcpcLevel - The user's XCPC level.
 * @property {string} background - The URL of the user's background image.
 * @property {number|null} eloValue - The user's ELO value.
 * @property {number} followingCount - The number of users this user is following.
 * @property {number} followerCount - The number of followers this user has.
 * @property {number|null} ranking - The user's ranking.
 * @property {number} passedProblemCount - The number of problems the user has passed.
 * @property {number} submittedProblemCount - The number of problems the user has submitted.
 * @property {number|null} elo - The user's ELO rating.
 * @property {number} registerTime - The user's registration time (timestamp).
 * @property {string} introduction - The user's introduction (in markdown format).
 * @property {Array} prize - The user's prizes.
 */

/**
 * @typedef {Object} PracticeData
 * @property {Problem[]} passed - List of problems the user has passed.
 * @property {Problem[]} submitted - List of problems the user has submitted.
 * @property {UserInfo} user - The user's information.
 * @property {Array} elo - The user's ELO history.
 */

(function() {
    'use strict';
    const REGEXP_FULL_USER_ID = /^\d+$/
    const REGEXP_FIND_URL_PRACTICE = /\/user\/\d+.+practice$/

    const colors = [
        'rgb(191, 191, 191)',
        'rgb(254, 76, 97)',
        'rgb(243, 156, 17)',
        'rgb(255, 193, 22)',
        'rgb(82, 196, 26)',
        'rgb(19, 194, 194)',
        'rgb(52, 152, 219)',
        'rgb(157, 61, 207)',
        'rgb(14, 29, 105)'
    ]
    const colorsOld = [
        'rgb(191, 191, 191)',
        'rgb(254, 76, 97)',
        'rgb(243, 156, 17)',
        'rgb(255, 193, 22)',
        'rgb(82, 196, 26)',
        'rgb(52, 152, 219)',
        'rgb(157, 61, 207)',
        'rgb(14, 29, 105)'
    ]

    let prev_pathname = ''

    let uid_in_fetch = null
    /** @type {Promise<PracticeData>} */
    let practice_data_in_fetch = null

    let uid_problems = null
    /** @type {Record<string, { dif: number, rendered: boolean }>} */
    let problems = {}
    let partRendered = false

    function getEditableProblemRecord (pid) {
        if (!(pid in problems)) return { dif: 0, rendered: true }
        return problems[pid]
    }

    async function fetchPracticeDataNoCache (uid) {
        if (!REGEXP_FULL_USER_ID.test(uid)) return null
        try {
            let csrfToken = document.querySelector('meta[name="csrf-token"]')?.content
            let response = await fetch(`/user/${uid}/practice`, {
                method: 'GET',
                headers: {
                    'X-Csrf-Token': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-Lentille-Request': 'content-only',
                    'Accept': 'application/json'
                },
                credentials: 'include'
            })
            /** @type {PracticeData} */
            let data = (await response.json())?.data
            return data || null
        } catch (err) {
            console.error('Better Luogu User Practice: fail to fetch practice data', err)
            return null
        }
    }

    async function fetchPracticeData (uid) {
        if (!REGEXP_FULL_USER_ID.test(uid)) return Promise.resolve(null)
        if (uid !== uid_in_fetch) {
            uid_in_fetch = uid
            practice_data_in_fetch = fetchPracticeDataNoCache(uid)
        } else if (await practice_data_in_fetch === null) {
            // previous fetch failed, retry
            practice_data_in_fetch = fetchPracticeDataNoCache(uid)
        }
        return practice_data_in_fetch
    }

    function getUserIdFromPath () {
        let match = window.location.pathname.match(/\/user\/(\d+)/)
        if (match) return match[1]
        return null
    }

    // `_feInstance` is deprecated and removed currently, so we need to fetch data manually.
    // returns true if something wrong and we should skip rendering
    async function updateProblems () {
        if (window.location.pathname === prev_pathname) return false
        const uid = getUserIdFromPath()
        if (!REGEXP_FULL_USER_ID.test(uid)) return true
        prev_pathname = window.location.pathname

        const data = await fetchPracticeData(uid)
        if (!data) return true
        problems = {}
        for (let passed of data.passed) problems[passed.pid] = { dif: passed.difficulty, rendered: false }
        for (let tryed of data.submitted) problems[tryed.pid] = { dif: tryed.difficulty, rendered: false }
        return false
    }

    function renderColor () {
        if (!REGEXP_FIND_URL_PRACTICE.test(window.location.href)) {
            if (partRendered) {
                for (let pid in problems) {
                    getEditableProblemRecord(pid).rendered = false
                }
                partRendered = false
            }
            return
        }
        if (partRendered) {
            let rendered = true
            for (let pid in problems) {
                if (!getEditableProblemRecord(pid).rendered) {
                    rendered = false
                    break
                }
            }
            if (rendered) return
        }
        for (let el of document.querySelectorAll('div.problems a')) {
            let pid = el.textContent
            let record = getEditableProblemRecord(pid)
            if (record.rendered) continue
            record.rendered = true
            partRendered = true
            el.style.color = colors[record.dif];
        }
    }

    function renderChart () {
        if (!REGEXP_FIND_URL_PRACTICE.test(window.location.href)) return
        let elDivList = document.querySelectorAll('div.difficulty-tags > div')
        let maxCount = 0
        let widthPerCount = Infinity
        for (let elDiv of elDivList) {
            let elText = elDiv.querySelector('span.problem-count')
            let count = Number((/\d+/.exec(elText?.textContent || '') || [])[0])
            if (count > maxCount) maxCount = count
            let elCaption = elDiv.querySelector('span.lfe-caption') || elDiv.childNodes[0]
            let width = Math.max(0, (elDiv?.offsetWidth - (elCaption?.offsetWidth || 100)) * 0.8)
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
                let elCaption = elDiv.querySelector('span.lfe-caption') || elDiv.childNodes[0]
                elChart = document.createElement('div')
                elChart.classList.add('__blup_chart')
                elChart.style.backgroundColor = elCaption?.style?.backgroundColor
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
        let aRecord = getEditableProblemRecord(aPid)
        let bRecord = getEditableProblemRecord(bPid)
        if (window.__betterLuoguUserPractice_sortByDifficulty && aRecord.dif != bRecord.dif) {
            if (aRecord.dif < bRecord.dif) return -1
            return 1
        }
        if (aPid < bPid) return -1
        if (aPid > bPid) return 1
        return 0
    }

    function sortProblems () {
        if (!REGEXP_FIND_URL_PRACTICE.test(window.location.href)) return
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

    async function main () {
        const isUserPage = () => window.location.pathname.startsWith('/user/')
        if (isUserPage() && !await updateProblems()) {
            renderColor()
            renderChart()
            sortProblems()
        } else if (partRendered) {
            for (let pid in problems) {
                getEditableProblemRecord(pid).rendered = false
            }
            partRendered = false
        }
        // if (isUserPage()) {
        //     for (let el of document.querySelectorAll('.introduction')) {
        //         if (el?.style?.display === 'none') {
        //             if (el.previousElementSibling?.textContent?.includes('暂不可见')) {
        //                 el.previousElementSibling.style.textDecoration = 'line-through'
        //             }
        //             el.style.display = ''
        //         }
        //     }
        // }
        if (isUserPage() && REGEXP_FIND_URL_PRACTICE.test(window.location.href)) {
            const uid = Number(getUserIdFromPath() || NaN)
            if (typeof uid === 'number' && !isNaN(uid)) {
                for (let elH3 of document.querySelectorAll('h3')) {
                    if (elH3.textContent.includes('尝试过的题目')) {
                        let el = elH3.querySelector('a')
                        let href = `https://www.luogu.com.cn/record/list?user=${ uid }`
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
            // 洛谷在该页面，难度为：0,1,2,3,4,5,6,6,7
            // 两个难度6无法区分，洛谷的锅
            let records = window._feInstance?.currentData?.records?.result
            if (Array.isArray(records)) {
                let elList = Array.from(document.querySelectorAll('span.pid')).map((el) => el.parentNode)
                for (let index = 0; index < elList.length; ++index) {
                    let dif = records[index]?.problem?.difficulty
                    if (typeof dif !== 'number') continue
                    let el = elList[index]
                    if (el.style.color !== colorsOld[dif]) el.style.color = colorsOld[dif]
                }
            }
        }
        if (window.location.pathname.match(/\/record\/\d+/)) {
            // 洛谷在该页面，难度为：0,1,2,3,4,5,6,6,7
            // 两个难度6无法区分，洛谷的锅
            let dif = window._feInstance?.currentData?.record?.problem?.difficulty
            if (typeof dif === 'number') {
                let color = colorsOld[dif]
                for (let elSpan of document.querySelectorAll('span.pid')) {
                    let el = elSpan.parentNode
                    if (el.style.color !== color) el.style.color = color
                }
            }
        }
    }

    let initialMain_started = false
    async function initialMain () {
        if (initialMain_started) return
        initialMain_started = true

        await main()
        while (true) {
            try {
                await main()
            } catch (err) {
                console.error('Better Luogu User Practice: error in main loop', err)
                await new Promise((resolve) => setTimeout(resolve, 1000))
            }
            await new Promise((resolve) => setTimeout(resolve, 500))
        }
    }
    initialMain()

    window.__BLUP = {
        fetchPracticeData,
        fetchPracticeDataNoCache,
        uid_in_fetch,
        practice_data_in_fetch
    }
})();