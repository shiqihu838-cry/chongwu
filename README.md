# MOMO · 生物参数实验室

将社交与运动数据转化成小生物外观的交互 demo。

## 在线体验

GitHub Pages：https://shiqihu838-cry.github.io/chongwu/

## 功能

- 五种基础种群：星芒、胶囊、圆形、方形、花朵。
- 调节颜色、饱和度、体长、胖瘦、角数、手臂长度、腿长与动作速度。
- 漫步、蹦跳、摇摆、漂浮四种动态步态。
- 模拟聊天频次、互动人数、步数、运动时长、运动规律性驱动外观。
- 四组生活场景、草图模式、随机生成、暂停与重置。
- 导出透明 PNG、独立 SVG 与 JSON 参数。

所有数据均为模拟数据，映射为可调整的设计假设，不访问真实账号或运动设备。

## 本地运行

直接打开 `index.html`，或在项目目录运行：

```sh
python -m http.server 8096
```

访问 http://localhost:8096 。核心功能无需安装依赖，字体加载失败时使用系统字体。

## 部署

GitHub Pages 发布来源：`main` 分支、根目录 `/`。

将修改提交到 `main` 后，GitHub 自动重新发布。`.nojekyll` 让 GitHub 直接提供静态文件，不执行 Jekyll。

## 调整数据映射

修改 `app.js` 中的 `mapDataToAppearance()`。页面使用原生 HTML、CSS、JavaScript 与参数化 SVG，资源均使用相对路径，兼容 GitHub Pages 的项目子路径。
