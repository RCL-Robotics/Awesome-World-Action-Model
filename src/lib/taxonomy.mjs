// Exact editorial labels shared by import validation and the website.
export const MAJOR_CATEGORIES = Object.freeze([
  '奠基性工作', 'VLA', 'WAM', '数据集', '评估指标（Metrics）', '评测基准与模拟器', 'WAM Components',
]);

export const COMPONENT_AREAS = Object.freeze([
  'Visual encoders & representations',
  'Language & vision-language backbones',
  'Generative modeling & tokenizers',
  'Video & world prediction backbones',
  'Spatial perception & geometry',
  'Action representations & policies',
  'Training & inference methods',
]);

// Reuse the existing source key to keep translated filter options unique.
export const componentSubcategory = (area) => area === 'Visual encoders & representations' ? '视觉编码器与表征' : area;

export const QUADRANTS = Object.freeze([
  'Q1 · One Model × 联合预测',
  'Q2 · One Model × IDM',
  'Q3 · Dual-system × 联合预测',
  'Q4 · Dual-system × IDM',
]);

export const QUADRANT_STATUSES = Object.freeze([
  ...QUADRANTS, '四象限外', '不适用', '待核实',
]);

export const ARCHITECTURES = Object.freeze(['One Model', 'Dual-system', '不适用', '待核实']);
export const PREDICTION_PARADIGMS = Object.freeze(['联合预测', 'IDM', '其他机制', '不适用', '待核实']);
export const CLASSIFICATION_STATUSES = Object.freeze(['综述明确', '一手资料核实', '部分待核实']);

export const QUADRANT_AXES = Object.freeze({
  [QUADRANTS[0]]: Object.freeze({ architecture: 'One Model', predictionParadigm: '联合预测' }),
  [QUADRANTS[1]]: Object.freeze({ architecture: 'One Model', predictionParadigm: 'IDM' }),
  [QUADRANTS[2]]: Object.freeze({ architecture: 'Dual-system', predictionParadigm: '联合预测' }),
  [QUADRANTS[3]]: Object.freeze({ architecture: 'Dual-system', predictionParadigm: 'IDM' }),
});

// Display translations only. Stored values and synchronization use the exact
// source labels above; future labels remain visible until a translation is added.
const ENGLISH_LABELS = new Map(Object.entries({
  '奠基性工作': 'Foundational work',
  'VLA': 'VLA',
  'WAM': 'WAM',
  '数据集': 'Datasets',
  '评估指标（Metrics）': 'Evaluation metrics',
  '评测基准与模拟器': 'Benchmarks & simulators',
  'Q1 · One Model × 联合预测': 'Q1 · One Model × Joint prediction',
  'Q2 · One Model × IDM': 'Q2 · One Model × IDM',
  'Q3 · Dual-system × 联合预测': 'Q3 · Dual-system × Joint prediction',
  'Q4 · Dual-system × IDM': 'Q4 · Dual-system × IDM',
  '四象限外': 'Outside quadrants',
  '不适用': 'Not applicable',
  '待核实': 'Pending verification',
  'One Model': 'One Model',
  'Dual-system': 'Dual-system',
  '联合预测': 'Joint prediction',
  'IDM': 'IDM',
  '其他机制': 'Other mechanisms',
  '综述明确': 'Explicit in survey',
  '一手资料核实': 'Verified from primary sources',
  '部分待核实': 'Partly pending verification',
  'VLA后训练与数据增强': 'VLA post-training & data augmentation',
  '三维占据与场景流数据': '3D occupancy & scene flow data',
  '三维场景与RGB-D数据': '3D scene & RGB-D data',
  '三维场景数据生成': '3D scene data generation',
  '三维多视角建模': '3D multiview modeling',
  '三维手部轨迹标注': '3D hand trajectory annotations',
  '三维物体资源': '3D object resources',
  '三维表示与状态估计': '3D representations & state estimation',
  '世界动作一致性': 'World-action consistency',
  '世界模型评测基准': 'World model benchmarks',
  '人形机器人基准': 'Humanoid robot benchmarks',
  '人类第一视角数据': 'Human egocentric data',
  '仿真到真实评测': 'Sim-to-real evaluation',
  '伪动作标注': 'Pseudo-action annotations',
  '分层与双系统VLA': 'Hierarchical & dual-system VLA',
  '动作策略基础': 'Action policy foundations',
  '双臂机器人数据': 'Dual-arm robot data',
  '合成数据与数据生成': 'Synthetic data & data generation',
  '图像质量指标': 'Image quality metrics',
  '基准与模拟器': 'Benchmarks & simulators',
  '基准与评测协议': 'Benchmarks & evaluation protocols',
  '多任务视觉标注': 'Multitask visual annotations',
  '多传感器与空间标注': 'Multisensor & spatial annotations',
  '多机器人协作感知数据': 'Multi-robot collaborative perception data',
  '多模态触觉VLA': 'Multimodal & tactile VLA',
  '多模态触觉音频': 'Multimodal, tactile & audio sensing',
  '多语言与时空标注': 'Multilingual & spatiotemporal annotations',
  '定位与SLAM数据': 'Localization & SLAM data',
  '导航': 'Navigation',
  '导航与驾驶示范数据': 'Navigation & driving demonstration data',
  '导航基准': 'Navigation benchmarks',
  '导航评估指标': 'Navigation metrics',
  '强化学习基准': 'Reinforcement learning benchmarks',
  '扩散与流匹配VLA': 'Diffusion & flow-matching VLA',
  '扩散与流匹配基础': 'Diffusion & flow-matching foundations',
  '数据采集接口': 'Data collection interfaces',
  '数据集与数据采集': 'Datasets & data collection',
  '未来表征辅助VLA': 'Future representation-assisted VLA',
  '机器人交互数据': 'Robot interaction data',
  '机器人操作基准': 'Robot manipulation benchmarks',
  '机器人示范与操作数据': 'Robot demonstration & manipulation data',
  '泛化与动作对齐': 'Generalization & action alignment',
  '泛化评测': 'Generalization evaluation',
  '游戏评测环境': 'Game evaluation environments',
  '潜动作预训练': 'Latent action pretraining',
  '潜空间预测与JEPA': 'Latent prediction & JEPA',
  '灵巧手与抓取数据': 'Dexterous hand & grasping data',
  '灵巧操作': 'Dexterous manipulation',
  '物理仿真': 'Physics simulation',
  '理论与规划': 'Theory & planning',
  '示范数据': 'Demonstration data',
  '神经世界模拟器': 'Neural world simulators',
  '神经策略评测环境': 'Neural policy evaluation environments',
  '离散动作VLA': 'Discrete-action VLA',
  '空间感知增强VLA': 'Spatially aware VLA',
  '策略后训练与WM-RL': 'Policy post-training & WM-RL',
  '类别与动作标注': 'Category & action annotations',
  '终身学习与知识迁移评测': 'Lifelong learning & knowledge transfer evaluation',
  '经典WM与模型式RL': 'Classical world models & model-based RL',
  '统计评测协议': 'Statistical evaluation protocols',
  '综合评分': 'Composite scores',
  '综述与技术资源': 'Surveys & technical resources',
  '联合视频动作建模': 'Joint video-action modeling',
  '自动驾驶': 'Autonomous driving',
  '自动驾驶VLA': 'Autonomous driving VLA',
  '自动驾驶基准': 'Autonomous driving benchmarks',
  '自动驾驶感知数据': 'Autonomous driving perception data',
  '自回归VLA': 'Autoregressive VLA',
  '行为与表征诊断': 'Behavior & representation diagnostics',
  '视觉编码器与表征': 'Visual encoders & representations',
  '视觉表征迁移基准': 'Visual representation transfer benchmarks',
  '视觉规划与IDM': 'Visual planning & IDM',
  '视觉语言导航数据': 'Vision-language navigation data',
  '视频动作理解数据': 'Video action understanding data',
  '视频生成Backbone': 'Video generation backbones',
  '视频语言预训练数据': 'Video-language pretraining data',
  '视频质量指标': 'Video quality metrics',
  '训练优化与蒸馏': 'Training optimization & distillation',
  '记忆与长时序': 'Memory & long-horizon modeling',
  '记忆与长时序VLA': 'Memory & long-horizon VLA',
  '评估指标与协议': 'Evaluation metrics & protocols',
  '评测协议与诊断': 'Evaluation protocols & diagnostics',
  '语言与VLM Backbone': 'Language & VLM backbones',
  '语言标注与再标注': 'Language annotation & reannotation',
  '语言生成指标': 'Language generation metrics',
  '跨机器人与多任务数据': 'Cross-robot & multitask data',
  '运动预测与规划数据': 'Motion prediction & planning data',
  '长时序与语言任务评测': 'Long-horizon & language-task evaluation',
  '驾驶仿真': 'Driving simulation',
  '驾驶数据': 'Driving data',
  '高效推理VLA': 'Efficient VLA inference',
  '高效推理与实时控制': 'Efficient inference & real-time control',
  '鲁棒性与泛化评测': 'Robustness & generalization evaluation',
}));

/** @param {string | null | undefined} value @returns {string} */
export function taxonomyLabel(value) {
  if (value == null) return 'Not assigned';
  return ENGLISH_LABELS.get(value) ?? value;
}
