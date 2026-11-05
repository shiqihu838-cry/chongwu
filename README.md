# 生物参数编辑器

在线体验：https://shiqihu838-cry.github.io/chongwu/

全屏编辑器，左侧预览宠物，右侧调整参数。宠物使用不透明纯色，角数控制整个身体的圆瓣轮廓（3–16 瓣），手脚与身体使用同一颜色，腿与圆头大脚为一体填充形状。

参数：颜色、饱和度、体长、胖瘦、角数、手长、腿长、步态和速度。模拟数据模式将聊天频次、互动人数、步数、运动时长和规律性映射到外观。均为演示数据和可调整的设计假设。

使用原生 HTML、CSS、JavaScript 和 SVG，无需安装依赖。直接打开 index.html，或执行 `python -m http.server 8096` 后访问 http://localhost:8096 。

GitHub Pages 发布来源为 main 分支根目录，推送后自动更新。映射函数为 app.js 中的 mapDataToAppearance()，轮廓生成函数为 bodyRadius() 与 bodyPath()。
