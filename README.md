# f-server
F-server nodejs + exparess  server


# 一、项目介绍
## 1.1 项目API参考
- /parse 提供完整的ParseServer服务
  - [JS调用手册](https://docs.parseplatform.org/js/guide/)
  - [RESTful API详解](https://docs.parseplatform.org/rest/guide/)
- /api 提供灵活的自定义API接口
  - [全栈API文档](./apidoc)
  - [接口描述规范](http://apidocjs.com/)

## 1.2 项目目录结构
- cloud 私有云码
  - ParseServer补充代码
  - 包括自定义触发器、自定义后台任务等
  - 多用于对象权限的精准控制
- api 商业接口
  - 基于express完全自定义的HTTP接口
  - 用于特殊工具类API编写，第三方接口API编写，分析查询类API编写
- config 项目配置
- public
  - index.tpl.html 项目首页加载README.md的模板
  - apidoc 自动生成的接口描述HTML页面
- test 单元测试
- views 基于hbs的网页渲染模板
- init-project-home.js 项目主页、文档生成脚本
- server.js 程序总入口
- apidoc.json 接口生成器配置文件
- README.md 说明文档

## 1.3 相关第三方库
- 主要依赖
  - parse-server 后端即服务，提供基础数据处理
  - express 提供Parse模块运行环境
  - mocha 基于REST单元测试
  - chai.js BDD断言
- 功能依赖
  - qiniu 七牛云存储SDK http://developer.qiniu.com/code/v6/sdk/nodejs.html
- 支付依赖
  ```
  cnpm i -S alipay-sdk xlsx mquery node-bin-setup is isuri camelcase-keys snakecase-keys @fidm/x509 is-json cheerio-select are-we-there-yet gauge sqlstring
  ```

# 三、开发手册
## 性能监控插件配置 Newrelic
- https://one.newrelic.com/
  - 看板：https://one.nr/0GbRmOrlVQy
  - 账号：ryanemax@gmail.com

## 启动本地测试环境
第一步：安装所需工具
- npm/nodejs
- postgresql

第二步：安装环境依赖
``` sh
# 安装npm依赖
npm config set registry https://registry.npmmirror.com/

npm i -g pkg@5.8.0 bytenode@1.3.6 n

n 16.16.0

npm i

# 运行测试
cnpm
```

第三步：创建配置文件
- 根目录下创建文件，名称为：config.json
- 请从./config/config.xxx.json复制配置文件，到根目录下config.json中

第四步：使用本地启动指令
``` sh
# 单点部署
node server.js --local --config ./config/config.f.json
# 分布部署
pm2 start server.js --name "nova-server" -- --config ./config/config.nova.json
```

## 项目单元测试（未完成）

参考文章：
- [Unit Testing Parse Cloud Code](http://jimkubicek.com/blog/2013/01/26/unit-testing-parse-cloud-code/)
- [mocha中文实例](http://www.ruanyifeng.com/blog/2015/12/a-mocha-tutorial-of-examples.html)
- [mocha参考手册](http://mochajs.org/#installation)
- [chai参考手册](http://chaijs.com/api/bdd/)

# 四、打包部署（生产环境）
- pkg server.js --target node10-linux-x64

# 五、线上运行（开发者）
### 运行监控
- pm2 生产环境，集群运行监控
  - cnpm i -g pm2

``` sh
git reset --hard
git pull origin HEAD
npm install
pm2 stop myapp -f

pm2 start server.js -name myapp

# 加参数启动
pm2 start server.js --name "anas-cloud" -- --config ./config/config.anas.cloud.json
pm2 start server.js --name "dev" -- --config ./config/config.dev.json
pm2 start server.js --name "futurestack" -- --config ./config/config.futurestack.json
```

