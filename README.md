# Osiris-GroupIndexer

该项目基于 [Project Osiris](https://github.com/wfjsw/project-osiris) 开发，为 [Project Osiris](https://github.com/wfjsw/project-osiris) 下属插件。

该项目为独占插件组，请尽量避免在同一个 Osiris 实例中同时运行该项目和其他插件。

当前上线的公共实例为：[@zh_groups_bot](https://telegram.org/zh_groups_bot)

## Features

1. 索引大量群组 (基于 RethinkDB)
2. 提供群组信息自助查询 (plugins/gpindex_listing.js)
3. 提供群组信息自助提交、更改、删除功能 (plugins/gpindex_enroller.js)
4. 提供自动化频道推送更新 (plugins/gpindex_publisher.js)
5. 提供管理员审核群链接面板 (plugins/gpindex_checker.js)
6. 提供简易管理指令，支持群组管理或个人管理 (plugins/gpindex_admin.js)
7. 支持错误自动汇报
8. 支持简易语言资源修改 (resources/gpindex_*.json)

## Install

1. 配置安装 [Project Osiris](https://github.com/wfjsw/project-osiris) 环境
2. 配置安装 [RethinkDB](https://rethinkdb.com)
3. 将 `lib` `plugins` `resources` 三个文件夹复制到 Osiris 根目录
4. 将 `config.diff.json` 的内容添加到原 `config.json` 中
5. 运行 `sh INSTALL` 安装依赖模块
6. 启动项目 `node app`

## Configure

在 `config.diff.json` 中：

`gpindex_db`(Object) 键按照 RethinkDB-Doc:`r.connect` 传参配置  
`gpindex_admin`(Integer) 键指定管理员。管理员 ID 可为 正(个人) 亦可为 负(群组)  
`gpindex_tags`(Array) 键传入一组分类  
`gpindex_channel`(String) 键指定更新发布的目的群组  

在 RethinkDB 数据库中：

配置项目专用 DB，在该 DB 中创建表 `groups`，设置主键为 `id`

## Licensing

This Project is distributed under GPL-3.0. See LICENSE for more details.