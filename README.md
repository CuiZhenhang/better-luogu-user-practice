# 更好的洛谷用户练习情况

由 [CuiZhenhang](https://www.luogu.com.cn/user/561644) 制作的**油猴脚本**，有较优的性能和较少 bug。

性能情况：对于题目数超过 4000 的 [Alex\_Wei](https://www.luogu.com.cn/user/123294) 的练习情况，该插件平均只需约 100ms 即可完成工作；每秒只需约 2ms 用于检查网页。  
**该插件运行耗时与题目数几乎成线性关系。**

## 功能速览

- 用户练习情况——以颜色显示题目难度；
- 用户练习情况——“尝试过的题目”按照题目难度再编号排序；
- 用户练习情况——增加查看用户评测记录入口；
- 评测记录——以颜色显示题目难度。
- 用户主页——显示用户个人介绍

另外，全局变量 `window.__betterLuoguUserPractice_costTime` 反映了本插件运行时间，将 `window.__betterLuoguUserPractice_sortByDifficulty` 设置为 `false` 可临时取消按难度排序。

## 已知问题

- 该插件每隔 0.5s 检查一次网页，**网页加载完成后**最多约 0.5s 可见到效果。但实际情况可能会比这慢很多，是因为**洛谷加载得太慢了**。
- 若界面切换过快，用户练习情况——以颜色显示题目难度可能无法正常工作。刷新即可解决。

## 使用方法

- 打开 [BLUP.user.js](BLUP.user.js) 文件，然后将内容复制进油猴即可。
- 或者，在安装油猴后，直接打开[来自 jsDelivr 的链接](https://cdn.jsdelivr.net/gh/CuiZhenhang/better-luogu-user-practice/BLUP.user.js)。
