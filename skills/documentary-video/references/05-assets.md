# 阶段 5：素材与参考

三种画风（Canvas 光影、扁平插画、逐帧手绘）的画面全部用代码绘制，真实照片、报纸、地图**只当绘画参考**（确认人物特征、建筑结构、服装道具、地图轮廓、历史图件的内容），画面上不直接出现。仍按本文件搜集和登记来源；"降级顺序"中的第 3 级（代码绘制）是常态而不是降级。公有领域的历史图件（如手绘草图、旧地图）可以用所选画风重绘，画面上注明"重绘"。

按 STORYBOARD.md 末尾的素材汇总，逐项搜集真实素材。

## 搜索来源

先用 Wikimedia Commons，它的 API 可以直接查到许可信息：

```bash
# 搜索文件
curl -s -A "Mozilla/5.0 (documentary research)" \
  "https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6&srsearch=关键词&format=json&srlimit=10"
# 查某个文件的下载地址和许可
curl -s -A "Mozilla/5.0 (documentary research)" \
  "https://commons.wikimedia.org/w/api.php?action=query&titles=File:文件名&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1600&format=json"
```

`extmetadata` 里的 `LicenseShortName` 是许可类型，`Artist` 是作者。

Commons 找不到时，继续查：
- Library of Congress（照片、地图），其中 Chronicling America 有大量美国历史报纸
- 美国国家档案馆、NASA 等美国联邦政府机构（作品一般属于公有领域）
- Smithsonian Open Access、Rijksmuseum、NYPL Digital Collections、Wellcome Collection
- Flickr Commons（各国档案馆上传，标注"无已知版权限制"）
- Internet Archive（老书、老杂志、老报纸扫描）
- 事件发生国本地的档案馆，用当地语言搜索

每个来源的许可条件不同，下载前都要确认。

## 登记

下载到 `assets/raw/`，每一项登记到 `assets/SOURCES.md`：

| 文件名 | 内容 | 来源链接 | 作者 | 许可 | 是否需署名 | 用于分镜 | 降级等级 |

## 找不到时的降级顺序

1. **扩大搜索**：用上面所有来源、换关键词、换语言。
2. **相关素材替代**：当事人住过的城市、工作过的建筑、同时代街景、同类物品、签名、手稿、报道他的报纸。不能把别人的照片当成当事人。
3. **代码绘制示意**：人物剪影（只有轮廓，不画五官）、地图、时间线、图表、大字排版、象征性物件（硬币、车票、信封、钥匙）。必须一眼看得出是插画或图示，不能伪装成历史照片或真实报纸。
4. **AI 生成图片**：只有用户明确同意后才能用；不生成写实的真实人物肖像，不做成以假乱真的老照片。

任何分镜降到第 3 或第 4 级，都要列出来告诉用户，由用户决定是否接受。原因：观众默认纪录片画面是真实档案，补位画面多了，用户需要知情并判断这个选题还值不值得做。

## 第一个停顿点：素材清单

搜集完后，给用户一份清单：每个分镜用了什么素材、来源、许可、降级等级。等用户确认后再处理图片。

## 处理参考资料

- **人物**：按 rules.md 的人物规则，照参考资料画角色设计稿，用户确认后全片复用。
- **地图**：轮廓优先用公有领域的地理数据（如 Natural Earth）生成，再按画风上色，比凭印象手画更准。
- **历史图件**：用画风重绘时保留原件的关键信息（标注、位置、数字），不改写原件内容。

## 第二个停顿点：样图

挑 3-5 个代表性的重绘结果（角色、地图、历史图件）给用户看，确认风格后再进入下一阶段。
