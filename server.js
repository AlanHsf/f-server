"use strict";
const fs = require("fs");     // 访问系统文件
const path = require('path');
const process = require('process');
const pm2 = require('pm2')
require(path.join(__dirname,"./api/utils/promise-prefix"));


// 加载log4js日志插件
require(path.join(__dirname,"./middle/log4js.middle.js"));



const express = require('express');
const { default: ParseServer, ParseGraphQLServer } = require('parse-server');

var responseTime = require('response-time');
var app = express();
var RequestClient = require("request");

const cookieParser = require('cookie-parser');
app.use(cookieParser());
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({ limit: '10mb' }));

let hbs = require('handlebars');            // template模板渲染
let exphbs = require('express-handlebars'); // 模板渲染

// 命令行参数处理，加载全局配置
const argv = require('yargs').argv
//var configFilePath = './config.json'
var configFilePath = path.join(__dirname, 'config.json') // 配置文件地址
var isScheduleHost = false
if (argv.schedule) {
    isScheduleHost = true
    global.isScheduleHost = true;
}

var isLocal = false     // 是否本地运行
if (argv.config) {    // 加载配置文件 config.json
    configFilePath = argv.config
}

if (argv.local) {     // 加载配置文件
    isLocal = true
    global.isLocal = true;
}

startServer();

async function startServer() {
    var Config, port, appId;
    // 0. 通过安全授权配置，获取平台配置参数
    if (argv.authCode) {     // 加载安全授权配置信息
        global.isAuthCheck = true;  // 是否开启授权检测
        global.authCode = argv.authCode;

        let authRes = await new Promise((resolve, reject) => {
            RequestClient({
                method: "GET",
                url: `https://test.fmode.cn/parse/classes/DevAuth?where={"authCode":{"$eq":"${global.authCode}"}}`,
                headers: {
                    'X-Parse-Application-Id': 'nova'
                }
            },
                function (err, res, body) {
                    if (!err) {
                        let result = JSON.parse(body);
                        resolve(result && result.results && result.results[0] || null);
                    } else {
                        resolve(null);
                    }
                })
        })
        console.log("当前平台：", authRes.name)
        console.log("绑定域名：", authRes.domain)
        let isAuthDays = authRes.expiredAt ? (new Date(authRes.expiredAt.iso) - new Date()) / 1000 / 60 / 60 / 24 : 65535;
        // console.log("维护期限：",authRes.expiredAt?authRes.expiredAt.iso:"无限")
        console.log("授权代码", authRes.authCode)
        console.log("授权状态：", (isAuthDays).toFixed(0))
        // console.log("授权状态：",isAuthDays>0?'有效':'无效')
        if (isAuthDays < 0) { return }
        Config = authRes.configJson;
        global.Config = Config;
    } else {
        Config = require(configFilePath);
        global.Config = Config;
    }

    port = Config.parse.port
    global.port = port
    appId = Config.parse.appId
    console.log(port, appId)
    if (global.isLocal) {
        console.log(Config.parse.databaseURIOnline)
    } else {
        console.log(Config.parse.databaseURI)
    }

    // 1. 加载Helper，相当于Angular中的Pipe和结构型指令
    hbs.registerHelper('dateFormat', require('handlebars-dateformat'));
    hbs.registerHelper('if_eq', function (a, b, opts) {
        if (a == b) // Or === depending on your needs
            return opts.fn(this);
        else
            return opts.inverse(this);
    });
    hbs.registerHelper("addOne", function (value, options) {
        return Number(parseInt(value) + 1);
    });
    hbs.registerHelper("reduceOne", function (value, options) {
        return Number(parseInt(value) - 1);
    });
    hbs.registerHelper("engIndex", function (value, options) {
        let start = "A"
        let code = start.charCodeAt()
        let index = String.fromCharCode(code + value)
        return index;
    });


    //加载模板引擎
    app.use(express.static(path.join(__dirname, 'public')));
    app.engine('hbs', exphbs({
        defaultLayout: 'main',
        extname: '.hbs'
    }));
    app.set('view engine', 'hbs');


    // 加载接口请求时间统计中间件
    let apiLogLevel = "ALL" // ALL 全部 SLOW 超过2000毫秒
    if (global.Config.apiLogLevel) {
        apiLogLevel = global.Config.apiLogLevel;
    }
    app.use(responseTime((req, res, time) => {
        let stat = (req.method + req.originalUrl);
        let toolong = 2000;
        switch (apiLogLevel) {
            case "SLOW":
                toolong = 2000;
                break;
            case "ALL":
                toolong = 0;
                break;
            default:
                break;
        }
        if (time >= toolong) {
            console.error(stat, time.toFixed(0) + "ms");
        }
    }));
    


    // 加载Parse客户端服务中间件
    let parseMiddle = require(path.join(__dirname, './middle/parse.middle.js'))
    app.use(parseMiddle)

    // 加载全局服务至global中
    //let openapi = require(path.join(__dirname, './api/api-common/open/openapi.js'))
    //global.openapi = openapi;
    //let ScheduleService = require(path.join(__dirname,"api/api-common/system/serv-schedule"))
    //global.ScheduleService = ScheduleService;

    // 加载路由分发（公用接口）
    let routesApiCommon = require(path.join(__dirname, './api/api-common/routes'))
    routesApiCommon(app)

    // 加载路由分发（模块接口）
    let routesApiModule = require(path.join(__dirname, './api/api-module/routes'))
    routesApiModule(app)

    /***************** 加载Parse及设置配置文件 *****************/
    if (!isLocal) { // 当线上环境运营时，正常加载Parse服务
    } else { // 当本地测试环境时，通过远程账号加载Parse服务
        Config.parse.databaseURI = Config.parse.databaseURIOnline;
    }
    let parseServer = new ParseServer(Config.parse);
 
    app.use('/parse', parseServer.app);


   

    // 统一错误处理
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        /**
         * @param code number  0成功 1失败
         */
        var error = {
            code: err.code || 1,
            msg: err.msg || err.message,
            stack: err.stack,
            data: err.data,
            // err: err,
        };
        // console.log(err);
        res.json(error);
    });

    // app.listen(port, function () {
    //     console.log(`${appId} running on port ${port}.`);
    // });
    let httpServer = require('http').createServer(app);
    httpServer.listen(port);
    ParseServer.createLiveQueryServer(httpServer);

    if (!global.isAuthCheck || global.isLocal) {
        if(fs.existsSync(path.join(__dirname, "init-project-home.js"))){
            // 生成项目首页（开发环境）
            var initProjectSite = require(path.join(__dirname, 'init-project-home.js'));
            initProjectSite(port)
        }
    }

    /*
     * 定义全局错误处理函数
     * 解决pm2下bytenode应用在cluster模式无法重启问题
     * 所有终止信号，都需要调用pm2重启服务
    */
    process.on('SIGINT', (signal) => {
        console.error('SIGINT signal received.')
        errorHandler(httpServer,signal)
    })
    process.on('SIGTERM', (signal) => {
        console.error('SIGTERM signal received.')
        errorHandler(httpServer,signal)
    })
    process.on('uncaughtException', (err) => {
        console.error('uncaughtException err received.')
        errorHandler(httpServer,"uncaughtException",err)
    })
    process.on('unhandledRejection', (err) => {
        console.error('unhandledRejection err received.')
        errorHandler(httpServer,"unhandledRejection",err)
    })

    /*
     * 加载系统定时任务（仅SCHEDULE_HOST，加载定时任务并执行）
     * 
     * 
    */   
    let scheduleServ1 = new global.ScheduleService();
    let scheduleServ2 = new global.ScheduleService();
    await scheduleServ1.init();
    console.log(scheduleServ2.JobList);
    /* 定时任务加载完成 */
}

async function errorHandler(httpServer,signal,err){
    if(err){
        console.error(err);
        // loggerError.error(err);
        let stack = err.stack;
        if(stack){
            stack.split("\n").forEach(line=>{
                console.error(line)
            })
            // console.error(stack.slice(0,1000));
        }

        if(signal=="unhandledRejection"){
            return
        }
        if(signal=="uncaughtException"){
            return
        }
    }
// Stops the server from accepting new connections and finishes existing connections.
        httpServer&&httpServer.close();
        if(pm2Name || pm2Name>=0){
            console.log("restart:",pm2Name)
            pm2.connect(function(errpm2) {
                if(errpm2){
                    shutdown(signal)
                }
                pm2.restart(pm2Name, (errpmrestart, proc) => {
                    // Disconnects from PM2
                    pm2.disconnect();
                })
                shutdown(signal)
            })
        }else{
            shutdown(signal)
        }
}
function shutdown(signal){
    if (signal) {
        process.exit(1)
    }
}

function licenseNotice(){
    var license = `
    该文件是本项目的一部分 This file is part of the App project.
    版权所有 © AlanH 
    保留所有权利 All Rights Reserved.
    严禁在未经授权的情况下，通过任何媒介复制此文件 Unauthorized copying of this file, via any medium is strictly prohibited
    该文件是专有的机密文件 Proprietary and confidential
   
    Copyright 2021-07-26 Fmode Inc. 1342241510@qq.com 15207975259.
    保留所有权利 All rights reserved.
   `
   return license
}