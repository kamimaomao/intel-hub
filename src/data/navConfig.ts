export type NavLink = {
  label: string;
  value: string;
};

export const topNavLinks: NavLink[] = [
  { label: "全部情报", value: "全部" },
  { label: "AI 与游戏", value: "AI与游戏" },
];

export const directCategoryLinks: NavLink[] = [
  { label: "小游戏", value: "小游戏" },
  { label: "其他", value: "其他" },
];

export const groupedCategoryLinks = [
  {
    title: "发行",
    links: [
      { label: "买量数据与素材", value: "发行·买量数据与素材" },
      { label: "行业大盘与新游", value: "发行·行业大盘与新游" },
      { label: "流水榜单与市场", value: "发行·流水榜单与市场" },
      { label: "立项选品与休闲发行", value: "发行·立项选品与休闲发行" },
      { label: "广告变现策略", value: "发行·广告变现策略" },
    ],
  },
  {
    title: "研发",
    links: [
      { label: "爆款拆解与系统复盘", value: "研发·爆款拆解与系统复盘" },
      { label: "策划与设计方法论", value: "研发·策划与设计方法论" },
      { label: "数值设计", value: "研发·数值设计" },
      { label: "研发技术与独立开发", value: "研发·研发技术与独立开发" },
      { label: "小游戏立项", value: "研发·小游戏立项" },
    ],
  },
  {
    title: "出海",
    links: [
      { label: "出海资讯与策略", value: "出海·出海资讯与策略" },
      { label: "海外买量与素材", value: "出海·海外买量与素材" },
      { label: "海外数据与榜单", value: "出海·海外数据与榜单" },
      { label: "短剧出海与分发", value: "出海·短剧出海与分发" },
    ],
  },
];

export const playTypeLinks: NavLink[] = [
  { label: "SLG", value: "SLG" },
  { label: "合成", value: "合成" },
  { label: "模拟经营", value: "模拟经营" },
  { label: "休闲", value: "休闲" },
  { label: "超休闲", value: "超休闲" },
  { label: "三消", value: "三消" },
  { label: "卡牌", value: "卡牌" },
  { label: "放置", value: "放置" },
  { label: "Roguelike", value: "Roguelike" },
  { label: "塔防", value: "塔防" },
  { label: "二次元", value: "二次元" },
  { label: "重度MMO", value: "重度MMO" },
];

export const themeLinks: NavLink[] = [
  { label: "买量素材", value: "买量素材" },
  { label: "数值设计", value: "数值设计" },
  { label: "IAA变现", value: "IAA变现" },
  { label: "IAP混变", value: "IAP混变" },
  { label: "出海", value: "出海" },
  { label: "爆款拆解", value: "爆款拆解" },
  { label: "AI工具", value: "AI工具" },
  { label: "平台政策", value: "平台政策" },
  { label: "融资资本", value: "融资资本" },
  { label: "榜单数据", value: "榜单数据" },
  { label: "投放ROI", value: "投放ROI" },
  { label: "长线运营", value: "长线运营" },
];
