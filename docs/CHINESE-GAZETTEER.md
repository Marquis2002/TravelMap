# 中文界面与本地地点库

网站为 <http://localhost:5173>，编辑器为 <http://localhost:5174>。双击根目录的 `Start-TravelMap.cmd` 启动；手机地址以启动窗口显示为准。

首次访问默认简体中文。网站语言按钮和编辑器右上角语言列表均可切换简体中文、英语、意大利语，选择保存在各自浏览器中。已有语言选择继续生效。

## 使用

- 在旅行中选择“添加地点”，使用“搜索地点”。支持 `广州`、`广州市`、`Guangzhou`、`guang zhou`，以及 `西安`、`xian`、`xi’an`。
- 同名区县可输入 `北京 朝阳` 或 `吉林 长春 朝阳`，看清结果右侧的省、市后再选择。拼音首字母和错别字纠错不在本轮范围内。
- 新地点自动保存中文译名，不必先到设置页配置翻译语言。基础名称和 ID 用于稳定存储；切换界面语言不会改变文件路径及行程引用。
- 导入存在多个候选时，需先选择地点才能应用，不按人口自动选择。
- 照片选择“本机（media 文件夹）”上传。资料快照只备份 `data/`；请另行备份 `media/` 中的照片。

## 数据来源和覆盖

大陆使用 [AreaCity-JsSpider-StatsGov 2025.251231.260403](https://github.com/xiangyuecn/AreaCity-JsSpider-StatsGov/releases/tag/2025.251231.260403)，数据发布于 2026-04-03。作者 xiangyuecn，MIT 许可，完整许可在 `scripts/gazetteer/LICENSE-AreaCity.txt`。上游综合国家地名信息库、腾讯及高德行政区划资料。

生成结果为 **3,182 条大陆行政地点**和 **13 条港澳台主要地点**。大陆覆盖固定版本中的地级及县级节点；31 个省级区域用来组织上下级关系，四个直辖市同时作为城市保留。剔除 43 个中间分组或三级联动重复节点。所保留节点缺失坐标数量为 **0**。没有添加乡镇或景点库。

该版本明确遗漏新疆和康县、和安县，不视为已经覆盖。没有用其他城市坐标补齐。逐省数量、剔除节点清单、缺失坐标及来源校验值见 `apps/travel-map-editor/vite/data/chinaPlaces.report.json`。

大陆原始 GCJ-02 坐标经过迭代转换为 WGS84，保留六位小数；行政地点代表点适用于旅行定位，不是测绘精度承诺。已有旅行地点坐标没有转换或覆盖。

香港、澳门、台北、桃园、台中、台南、高雄、基隆、新竹、嘉义、花莲、台东的坐标来自锁文件固定的 `all-the-cities@3.1.0` 内置 GeoNames 记录。每条来源 ID 保存在索引中，可通过 `https://www.geonames.org/编号/` 核验。新北使用 [GeoNames 12908892](https://www.geonames.org/12908892/new-taipei-city.html) 的 WGS84 坐标 `121.45703, 25.06199`，于 2026-10-27 核验。GeoNames 数据按 [CC BY 4.0](https://www.geonames.org/about.html) 署名；`all-the-cities` 软件采用 MIT。

原世界库的人口筛选继续生效，中国行政索引不受人口门槛限制。原世界库额外地点仍保留；仅广州、三亚、北京、西安及明确对应的港澳台 GeoNames 记录进行了来源合并，其他同名或相似拼音不会自动合并。未知人口不显示为零。

## 重建索引

在项目根目录操作，使用 Node.js 24 和已安装的工作区依赖。日常查询完全离线，下载只在重建数据准备阶段进行。

1. 下载固定版本的两个压缩包，放到已忽略的 `.local-runtime/gazetteer-source/`：
   - [ok_data_level3-4.csv.7z](https://github.com/xiangyuecn/AreaCity-JsSpider-StatsGov/releases/download/2025.251231.260403/ok_data_level3-4.csv.7z)
   - [ok_geo.csv.7z](https://github.com/xiangyuecn/AreaCity-JsSpider-StatsGov/releases/download/2025.251231.260403/ok_geo.csv.7z)
2. 解压出 `ok_data_level3.csv` 和 `ok_geo.csv`。原始边界文件体积较大，不纳入项目发布文件。
3. 执行 `node scripts/gazetteer/generate.mjs`。也可传入其他原始文件目录作为第一个参数。脚本验证原始文件 SHA-256、上下级关系、来源标识唯一性和坐标范围，写出精简索引及覆盖报告。
4. 执行 `pnpm check` 和 `pnpm build`，然后停止并重新启动本地服务，重新加载 Node 端缓存。

压缩包 SHA-256：

```text
ok_data_level3-4.csv.7z
0b181b4105c32b2631b1c8c8654859f10684c3748b188ebe08f342291dec1169
ok_geo.csv.7z
675c3e9b8dec6444994d3ef53259a145304f6a957db8a5e601e55c0b9e61e21a
```

解压文件 SHA-256：

```text
ok_data_level3.csv
dd5a1594565b65fa3fea5ce4b9935e0b28908226949ae44f07ebfd533428e8ff
ok_geo.csv
ac2641b1cb137d099779f49b21b965919591af9d82a29a911f6270530fef8ed7
```

升级来源版本时，应同时更新脚本中的固定校验值并重新审查节点变化及覆盖报告，不能只替换下载文件。行政区划变化不自动迁移已有旅行资料。

## 本次资料兼容处理

已通过原版快照接口创建并读回校验：
`2026-10-27T08-29-12-290Z-before-chinese-migration.json`，位于 `.data-snapshots/`。

为 China、Guangzhou、Sanya 分别补充“中国”“广州”“三亚”，为广州、三亚添加对应 `gazetteerKey`。未覆盖已有译名。文件名、ID、原坐标、行程和照片引用未改变。迁移时没有发现其他待匹配地点，**未自动匹配清单为空**。旧文件不带 `gazetteerKey` 仍可读取。

全球底图及没有可靠译名的国外地点保留原名。地图的 34 个省级区划图层和 TAIWAN、MACAO、HONG KONG 重复英文标签过滤继续保留。地图资源仍可能需要联网。

## 验证记录

已用隔离浏览器验证首次中文、英意中切换后刷新保留、中文及拼音查询、同名朝阳区人工选择、中文文字行程导入、本机照片上传、缩略图与相册、重启后资料保留，以及 390×844 手机尺寸布局。原 Guangzhou、Sanya 的 ID、坐标和路径与迁移前逐项比对一致，原旅行文件 SHA-256 未变。临时旅行、阳朔测试地点和测试图片已清理。

相册新链接使用稳定城市 ID，同名异地不再共用相册；旧名称链接仅在唯一匹配时兼容。广州、三亚原地址保持有效。地图中国范围调整及来源限制见 `CHINA-MAP.md`。

真实手机的 Wi-Fi 连通性仍需在手机上确认。运行完整检查后如开发页面出现依赖缓存 504，停止并重新启动本项目，再刷新浏览器。

2026-10-28 最终验证：根目录 pnpm check 与 pnpm build 均通过，共 208 项测试（核心 69、网站 32、编辑器 107）。网站和编辑器中国范围图层均加载成功，本机通过局域网地址访问网站返回 200；5173 监听 0.0.0.0，5174 仅监听 127.0.0.1。实际应用浏览器的两端页面均已确认显示中文。构建仍有原有大文件包提示，React Doctor 有对象 URL 缓存和数组迭代两项性能提示。
