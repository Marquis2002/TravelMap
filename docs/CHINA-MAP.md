# 中国省级地图图层

打开网站，在地图右上角点击 **中国** 定位到中国范围，点击 **世界** 返回世界概览。勾选或取消 **省级区划** 可以显示或隐藏省界与中文名称。手机上也有这组按钮，可用双指继续放大地图。

图层包含 34 个省级行政区域：23 个省、5 个自治区、4 个直辖市和香港、澳门两个特别行政区。概览使用简称，进一步放大后显示全称。文字自动避让，因此较小或密集的区域需要放大才能看到名称。

世界底图不再单独显示英文 TAIWAN、MACAO、HONG KONG 标签；对应位置由省级图层显示台湾、澳门、香港的中文名称。

目前增加的是省级边界展示，旅行资料仍按原版城市与行程整理。省份点亮、已去省份数量和“点击省份查看照片”尚未接入；没有预填你的 26 省明细。

## 数据与代码位置

- 边界来源：[阿里云 DataV.GeoAtlas](https://datav.aliyun.com/portal/school/atlas/area_selector)。下载于 **2026-10-27**，原始地址：[100000_full.json](https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json)。
- `apps/travel-map/public/maps/china-provinces.geojson`：原样保存的边界文件，包含 34 个省级区域和上游附带的南海线段要素。SHA-256：`99adfeded5223848bbe37a0a12f8023e11ee12161c7800521c27db42fdeac275`。
- `apps/travel-map/public/maps/china-province-labels.geojson`：从边界文件生成的 34 个标签点。只选择 `properties.level === "province"`，坐标取 `centroid`，缺省时取 `center`；保留 `adcode` 与原始名称 `name`。`label` 是去掉省、市、自治区或特别行政区后缀后的简称。
- `ChinaProvinceLayers/ChinaProvinceLayers.tsx`：控制省界、名称、缩放级别和深浅主题颜色。通过静态文件 URL 加载坐标，不把整份数据打入 JavaScript 主包。
- `MapRegionControls/MapRegionControls.tsx`：中国／世界定位与图层开关。

以上组件位于 `apps/travel-map/src/features/map/components/`。这些边界文件由本机服务提供，浏览地图时不请求 DataV。中文文字使用设备的中文字体；城市标记和旅行线路继续保留。

## 中国范围覆盖（2026-10-28）

网站与编辑器共用 `ChinaBoundary` 图层，在世界底图上以不透明的中国范围覆盖冲突边界，关闭省级区划时仍保留。世界图层原有 China、Taiwan、Hong Kong、Macao 外轮廓不再绘制；港澳台与大陆使用一致的中国填色，内部区划由省级图层表示。地点库、旧行程 ID 和文件路径不因此重命名。

新增原始资产 `apps/travel-map/public/maps/china-national.geojson` 来自 [DataV 中国范围](https://geo.datav.aliyun.com/areas_v3/bound/100000.json)，SHA-256 为 `83ac502aeac66a5527607ec844169418505d990f1a2dc33226743643541eed3c`。已经检查藏南达旺、阿克赛钦、台湾、香港、澳门的代表点在范围内。原始南海线段随源文件保留。

核对依据为自然资源部[标准地图服务](https://bzdt.tianditu.gov.cn/)和[公开地图内容表示规范](https://www.fmprc.gov.cn/web/wjb_673085/zzjg_673183/bjhysws_674671/bhflfg/dtdmxgfl/202303/P020230313585504979937.pdf)。**DataV 是第三方矢量来源，不能当作官方审定标准地图。** 本次官方标准地图服务访问失败，尚未完成与官方原图逐段比对；代表点测试也不等同于边界全线、岛屿和线型准确性审查。当前完成的是本地中国视图的一致表达，官方标准图逐段核验仍待完成，不能声明“已通过官方审定”。

更新边界来源后，应同时重新生成标签点，并运行 `pnpm check` 与 `pnpm build`。地图资产测试检查 34 个行政代码、有效闭合边界、标签唯一性以及标签坐标与源数据的一致性。
