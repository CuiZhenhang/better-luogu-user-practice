// ==UserScript==
// @name         更好的洛谷用户练习情况 v2
// @namespace    http://tampermonkey.net/
// @version      2.2.1
// @description  功能：显示难易度统计条形图；显示题目难度；按题目难度和编号排序；快捷查看用户评测记录；
// @author       CuiZhenhang & EricWan (with ChatGPT-5.6-Sol)
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

    // v2.2.0:
    // Cache parsed #lentille-context.
    // Parsing JSON is local only and does NOT produce any network request.
    let lentilleContextText = null
    let lentilleContextData = null

    function getLentilleContextData () {
        const el = document.querySelector('script#lentille-context')
        if (!el) return null

        const text = el.textContent || ''

        if (text === lentilleContextText) return lentilleContextData

        try {
            const context = JSON.parse(text)

            lentilleContextText = text
            lentilleContextData = context?.data || null

            return lentilleContextData
        } catch (err) {
            console.error('Better Luogu User Practice: fail to parse lentille context', err)
            return null
        }
    }

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

    // `_feInstance` is deprecated and removed currently,
    // so we need to fetch data manually.
    //
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
            /*
             * v2.2.0
             *
             * 新版评测记录页不再提供旧的
             * span.pid / _feInstance 结构。
             *
             * 难度仍然由页面首屏数据提供，
             * 位于：
             *
             * #lentille-context
             *   -> data
             *   -> records
             *   -> result
             *
             * 新版 difficulty 已恢复为完整的
             * 0..8，因此使用 colors 而不是
             * colorsOld。
             *
             * 此处没有任何网络请求。
             */

            let records = window._feInstance?.currentData?.records?.result

            if (!Array.isArray(records)) {
                records = getLentilleContextData()?.records?.result
            }

            if (Array.isArray(records)) {
                /*
                 * 不依赖 DOM 顺序，
                 * 建立 PID -> difficulty 映射。
                 *
                 * 同一道题出现多次提交也没有问题。
                 */
                const difficultyByPid = new Map()

                for (const record of records) {
                    const pid = record?.problem?.pid
                    const dif = record?.problem?.difficulty

                    if (typeof pid === 'string' && typeof dif === 'number') {
                        difficultyByPid.set(pid, dif)
                    }
                }

                /*
                 * 新版结构：
                 *
                 * <div class="problem">
                 *   <a href="/problem/P10438">
                 *     <strong>P10438</strong>
                 *     [JOIST 2024] 塔楼 / Tower
                 *   </a>
                 * </div>
                 *
                 * 将颜色设置在整个 a 上，
                 * 因此题号和题名都会染色。
                 */
                for (const el of document.querySelectorAll('div.problem > a[href^="/problem/"]')) {
                    const href = el.getAttribute('href') || ''

                    const pid = decodeURIComponent(href).match(/^\/problem\/([^/?#]+)/)?.[1]
                    if (!pid) continue

                    const dif = difficultyByPid.get(pid)

                    if (typeof dif !== 'number') continue

                    const color = colors[dif]
                    if (typeof color !== 'string') continue
                    if (el.style.color !== color) el.style.color = color
                }
            }
        }
        if (window.location.pathname.match(/\/record\/\d+/)) {
            /*
             * v2.2.1
             *
             * 新版单条评测记录页与 record/list
             * 一样，不再提供旧的 span.pid / _feInstance
             * 结构。首屏数据位于：
             *
             * #lentille-context
             *   -> data
             *   -> record
             *   -> problem
             *
             * 新版右侧“所属题目”结构为：
             *
             * <span class="problem-row">
             *   <a href="/problem/P7371">
             *     <strong>P7371</strong>
             *     [COCI 2018/2019 #4] Kisik
             *   </a>
             * </span>
             *
             * 将颜色设置到整个 a 上，题号和题名
             * 会以与新版 record/list 相同的方式染色。
             *
             * 同时保留旧 span.pid 页面兼容逻辑。
             */

            let record = window._feInstance?.currentData?.record

            if (!record || typeof record?.problem?.difficulty !== 'number') {
                record = getLentilleContextData()?.record
            }

            const pid = record?.problem?.pid
            const dif = record?.problem?.difficulty

            if (typeof pid === 'string' && typeof dif === 'number') {
                const color = colors[dif]
                if (typeof color === 'string') {
                    for (const el of document.querySelectorAll('span.problem-row > a[href^="/problem/"]')) {
                        const href = el.getAttribute('href') || ''

                        const elPid = decodeURIComponent(href).match(/^\/problem\/([^/?#]+)/)?.[1]
                        if (elPid !== pid) continue
                        if (el.style.color !== color) el.style.color = color
                    }
                }
            }

            // 旧页面兼容：
            // 难度为 0,1,2,3,4,5,6,6,7，
            // 两个难度6无法区分。
            if (typeof dif === 'number') {
                const oldColor = colorsOld[dif]

                if (typeof oldColor === 'string') {
                    for (const elSpan of document.querySelectorAll('span.pid')) {
                        const el = elSpan.parentNode
                        if (el && el.style.color !== oldColor) el.style.color = oldColor
                    }
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