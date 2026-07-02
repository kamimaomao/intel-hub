export type NavLink = {
  label: string;
  value: string;
  count: number;
};

export const topNavLinks: NavLink[] = [
  { label: "📚 全部内容", value: "全部", count: 4184 },
  { label: "🤖 AI与游戏", value: "AI与游戏", count: 268 },
];

export const specialNavLinks = [
  { label: "❤️ 我的收藏", value: "favorites", message: "我的收藏需要原站收藏接口支持；当前先保留入口，不伪造收藏数据。" },
  { label: "💡 提建议", value: "feedback", message: "提建议是原站弹窗功能；当前先保留入口，不提交到原站。" },
  { label: "📣 更新日志", value: "changelog", message: "更新日志是原站独立页面；当前先保留入口，不把它当文章标签查询。" },
  { label: "💬 加入微信群", value: "group", message: "加入微信群是原站弹窗功能；当前先保留入口，不伪造二维码。" },
];

export const directCategoryLinks: NavLink[] = [
  { label: "小游戏", value: "小游戏", count: 493 },
  { label: "其他", value: "其他", count: 269 },
];

export const groupedCategoryLinks = [
  {
    title: "发行",
    count: 963,
    links: [
      { label: "买量数据与素材", value: "发行·买量数据与素材", count: 85 },
      { label: "行业大盘与新游", value: "发行·行业大盘与新游", count: 506 },
      { label: "流水榜单与市场", value: "发行·流水榜单与市场", count: 419 },
      { label: "立项选品与休闲发行", value: "发行·立项选品与休闲发行", count: 71 },
      { label: "广告变现策略", value: "发行·广告变现策略", count: 25 },
    ],
  },
  {
    title: "研发",
    count: 957,
    links: [
      { label: "爆款拆解与系统复盘", value: "研发·爆款拆解与系统复盘", count: 757 },
      { label: "策划与设计方法论", value: "研发·策划与设计方法论", count: 307 },
      { label: "数值设计", value: "研发·数值设计", count: 10 },
      { label: "研发技术与独立开发", value: "研发·研发技术与独立开发", count: 162 },
      { label: "小游戏立项", value: "研发·小游戏立项", count: 31 },
    ],
  },
  {
    title: "出海",
    count: 207,
    links: [
      { label: "出海资讯与策略", value: "出海·出海资讯与策略", count: 155 },
      { label: "海外买量与素材", value: "出海·海外买量与素材", count: 28 },
      { label: "海外数据与榜单", value: "出海·海外数据与榜单", count: 55 },
      { label: "短剧出海与分发", value: "出海·短剧出海与分发", count: 1 },
    ],
  },
];

export const playTypeLinks: NavLink[] = [
  { label: "SLG", value: "SLG", count: 113 },
  { label: "合成", value: "合成", count: 56 },
  { label: "模拟经营", value: "模拟经营", count: 116 },
  { label: "休闲", value: "休闲", count: 194 },
  { label: "超休闲", value: "超休闲", count: 17 },
  { label: "三消", value: "三消", count: 28 },
  { label: "卡牌", value: "卡牌", count: 76 },
  { label: "放置", value: "放置", count: 53 },
  { label: "Roguelike", value: "Roguelike", count: 73 },
  { label: "塔防", value: "塔防", count: 54 },
  { label: "二次元", value: "二次元", count: 204 },
  { label: "重度MMO", value: "重度MMO", count: 52 },
];

export const themeLinks: NavLink[] = [
  { label: "买量素材", value: "买量素材", count: 144 },
  { label: "数值设计", value: "数值设计", count: 36 },
  { label: "IAA变现", value: "IAA变现", count: 66 },
  { label: "IAP混变", value: "IAP混变", count: 30 },
  { label: "出海", value: "出海", count: 246 },
  { label: "爆款拆解", value: "爆款拆解", count: 560 },
  { label: "AI工具", value: "AI工具", count: 256 },
  { label: "平台政策", value: "平台政策", count: 134 },
  { label: "融资资本", value: "融资资本", count: 112 },
  { label: "榜单数据", value: "榜单数据", count: 151 },
  { label: "投放ROI", value: "投放ROI", count: 78 },
  { label: "长线运营", value: "长线运营", count: 288 },
];
