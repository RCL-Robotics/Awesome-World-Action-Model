# Classification scope review — 2026-09-13

This review covers the 59 former Foundational work entries, 80 former Components entries, and 85 unassigned entries. It uses the existing source-grounded reading reports and their identified primary evidence; it is not a claim that every source was newly read in full. All 564 bibliographic records and historical reading reports are retained.

Updated on 2026-09-14 to classify Diffusion Policy as Foundational work. The counts below include this correction.

## Scope

- **Foundational work:** evidenced historical foundations first published before 2026; publication date alone does not establish the role.
- **Components of WAMs:** core encoders, pretrained backbones, tokenizers, representations, and canonical action heads. A specialized WAM or policy method is not a generic component merely because it is reusable.
- **Related resources:** relevant surveys, robotics runtimes, supporting representations, security studies, and adjacent work outside the specific categories.
- **Benchmarks & simulators:** includes dedicated neural simulation frameworks. World-model systems that actually use prediction for planning or learned control can remain WAMs, without forcing them into a joint-prediction/IDM quadrant.

## Category counts

| Category | Before | After |
| --- | ---: | ---: |
| Foundational work | 59 | 42 |
| VLA | 35 | 46 |
| WAMs | 227 | 296 |
| Datasets | 32 | 38 |
| Evaluation metrics | 14 | 15 |
| Benchmarks & simulators | 32 | 63 |
| Components of WAMs | 80 | 30 |
| Related resources | 0 | 31 |
| Not assigned | 85 | 3 |

168 major-category assignments changed. The 85 previously unassigned entries are now categorized. Three different records are explicitly unresolved for relevance/removal review.

## Concrete corrections

- **Diffusion Policy (ref-393a36f38d60db8631f4):** Components → Foundational work. Its 2023 observation-conditioned action diffusion and receding-horizon control establish an action-policy foundation for later WAMs. The catalog retains its recorded journal-edition bibliography; the first release is documented separately.
- **4DGS-WAM (2608.25956):** Foundational work → WAM. The paper was submitted on 26 August 2026 and describes separate policy and world-model networks. Its action-conditioned forward prediction is recorded as Dual-system / Other mechanisms / Outside quadrants; KITTI future-frame results do not establish executed robot control.
- **DINO DETR (ref-5514771916f15e54d7e6):** Components → Related resources. This is the object detector, not the self-supervised DINO visual encoder. DINOv2/v3 remain core visual components.
- **VAE, CLIP, Wan, and Cosmos backbones:** retained among the curated core components. Runtime optimizations and task-specific learned simulators have been moved to their supported roles.

## Relevance review pending

| Record | Reason | Primary source |
| --- | --- | --- |
| Diagnosing and Mitigating Perception-Decision Misalignment in Omni-LLMs via Modality Subspace Activation | MSA changes Omni-LLM hidden states for multimodal multiple-choice question answering and measures option sensitivity after modality removal. It provides no world-transition predictor, robot action interface, or general pretrained encoder. Its CMS benchmark/metric accompanies a QA intervention, so forcing the entire work into WAM Components or robot evaluation metrics would misstate its scope. | [Source](https://arxiv.org/pdf/2608.14655) |
| BERT: A Review of Applications in Natural Language Processing and Understanding | The inspected source is a survey of BERT applications in NLP, not the original BERT representation-learning paper. It has no environment dynamics, robot control, action generation, or direct WAM component contribution; a keyword-level language-model connection is insufficient. | [Source](https://arxiv.org/pdf/2103.11943) |
| Advances and applications of occupancy models | The verified primary abstract concerns ecological species occurrence with missed detections/misidentification and an amphibian-pathogen system. This is ecological occupancy estimation, not robotic 3D occupancy, environment dynamics for action, or any WAM foundation/component. | [Source](https://pubs.usgs.gov/publication/70059793) |

These entries are not presented as valid components, foundations, or related WAM resources. They remain in the retained catalog for an explicit removal decision.

## Per-entry decisions

The [versioned review manifest](../data/classification-overrides.json) records the rationale, exact report fingerprint, and evidence IDs for each decision. Source dates supporting the Foundational boundary are listed below. Every title links to the reading report used in this audit.

| Entry | Previous category | Reviewed category | First release if foundational |
| --- | --- | --- | --- |
| [Auto-Encoding Variational Bayes](../data/reports/1312.6114.json) | Components of WAMs | Components of WAMs | — |
| [BEVDet: High-performance Multi-camera 3D Object Detection in Bird-Eye-View](../data/reports/2112.11790.json) | Components of WAMs | Components of WAMs | — |
| [LLaMA: Open and Efficient Foundation Language Models](../data/reports/2302.13971.json) | Components of WAMs | Components of WAMs | — |
| [Qwen-VL: A Versatile Vision-Language Model for Understanding, Localization, Text Reading, and Beyond](../data/reports/2308.12966.json) | Components of WAMs | Components of WAMs | — |
| [GAIA-1: A Generative World Model for Autonomous Driving](../data/reports/2309.17080.json) | Components of WAMs | Benchmarks & simulators | — |
| [Stable Video Diffusion: Scaling Latent Video Diffusion Models to Large Datasets](../data/reports/2311.15127.json) | Components of WAMs | Components of WAMs | — |
| [PaliGemma: A versatile 3B VLM for transfer](../data/reports/2407.07726.json) | Components of WAMs | Components of WAMs | — |
| [FAST: Efficient Action Tokenization for Vision-Language-Action Models](../data/reports/2501.09747.json) | Components of WAMs | Components of WAMs | — |
| [Cosmos-Transfer1: Conditional World Generation with Adaptive Multimodal Control](../data/reports/2503.14492.json) | Components of WAMs | Components of WAMs | — |
| [Gemma 3 Technical Report](../data/reports/2503.19786.json) | Components of WAMs | Components of WAMs | — |
| [Wan: Open and Advanced Large-Scale Video Generative Models](../data/reports/2503.20314.json) | Components of WAMs | Components of WAMs | — |
| [GAIA-2: A Controllable Multi-View Generative World Model for Autonomous Driving](../data/reports/2503.20523.json) | Components of WAMs | Benchmarks & simulators | — |
| [Seedance 1.0: Exploring the Boundaries of Video Generation Models](../data/reports/2506.09113.json) | Components of WAMs | Components of WAMs | — |
| [MoVieDrive: Urban Scene Synthesis with Multi-Modal Multi-View Video Diffusion Transformer](../data/reports/2508.14327.json) | Components of WAMs | Benchmarks & simulators | — |
| [Latent Action Pretraining Through World Modeling](../data/reports/2509.18428.json) | Components of WAMs | WAMs | — |
| [LongScape: Advancing Long-Horizon Embodied World Models with Context-Aware MoE](../data/reports/2509.21790.json) | Components of WAMs | Benchmarks & simulators | — |
| [World Simulation with Video Foundation Models for Physical AI](../data/reports/2511.00062.json) | Components of WAMs | Components of WAMs | — |
| [PAN: A World Model for General, Interactable, and Long-Horizon World Simulation](../data/reports/2511.09057.json) | Components of WAMs | Benchmarks & simulators | — |
| [Dexterity from Smart Lenses: Multi-Fingered Robot Manipulation with In-the-Wild Human Demonstrations](../data/reports/2511.16661.json) | Components of WAMs | Related resources | — |
| [MIND-V: Hierarchical World Model for Long-Horizon Robotic Manipulation with RL-based Physical Alignment](../data/reports/2512.06628.json) | Components of WAMs | Benchmarks & simulators | — |
| [Interactive World Simulator for Robot Policy Training and Evaluation](../data/reports/2603.08546.json) | Components of WAMs | Benchmarks & simulators | — |
| [V-JEPA 2.1: Unlocking Dense Features in Video Self-Supervised Learning](../data/reports/2603.14482.json) | Components of WAMs | Components of WAMs | — |
| [X-World: Controllable Ego-Centric Multi-Camera World Models for Scalable End-to-End Driving](../data/reports/2603.19979.json) | Components of WAMs | Benchmarks & simulators | — |
| [Persistent Robot World Models: Stabilizing Multi-Step Rollouts via Reinforcement Learning](../data/reports/2603.25685.json) | Components of WAMs | Benchmarks & simulators | — |
| [INSPATIO-WORLD: A Real-Time 4D World Simulator via Spatiotemporal Autoregressive Modeling](../data/reports/2604.07209.json) | Components of WAMs | Benchmarks & simulators | — |
| [Geometry Guided Self-Consistency for Physical AI](../data/reports/2605.08638.json) | Components of WAMs | VLA | — |
| [AttenA+: Rectifying Action Inequality in Robotic Foundation Models](../data/reports/2605.13548.json) | Components of WAMs | VLA | — |
| [NVIDIA OmniDreams: Real-Time Generative World Model for Closed-Loop Autonomous Vehicle Simulation](../data/reports/2606.03159.json) | Components of WAMs | WAMs | — |
| [PAIWorld: A 3D-Consistent World Foundation Model for Robotic Manipulation](../data/reports/2606.18375.json) | Components of WAMs | Benchmarks & simulators | — |
| [Embodied.cpp: A Portable Inference Runtime of Embodied AI Models on Heterogeneous Robots](../data/reports/2607.02501.json) | Components of WAMs | Related resources | — |
| [FlowDAgger: Human-in-the-Loop Adaptation of Generative Robot Policies in Latent Space](../data/reports/2607.08877.json) | Components of WAMs | WAMs | — |
| [Artificial Foveated Perception for Mitigating Shortcut Learning in Robotic Foundation Models](../data/reports/2607.10655.json) | Components of WAMs | VLA | — |
| [EgoGenesis: Egocentric World-Action Modeling with Online Anchored Projective Memory and Action-3D RoPE](../data/reports/2607.28243.json) | Components of WAMs | Benchmarks & simulators | — |
| [Disentangling Visuo-Tactile Foresight: Oracle-Guided Interface Discovery for World Action Models](../data/reports/2608.00547.json) | Components of WAMs | WAMs | — |
| [PhyAI: Real-Time Physical AI at the Edge, Scalable Rollouts in the Cloud](../data/reports/2608.03682.json) | Components of WAMs | Related resources | — |
| [Diagnosing and Mitigating Perception-Decision Misalignment in Omni-LLMs via Modality Subspace Activation](../data/reports/2608.14655.json) | Components of WAMs | Not assigned | — |
| [Prismatic VLMs: Investigating the Design Space of Visually-Conditioned Language Models](../data/reports/ref-02a3d941412699a67ab3.json) | Components of WAMs | Components of WAMs | — |
| [Learning Latent Action World Models In The Wild](../data/reports/ref-03e87a8030d42fa6e525.json) | Components of WAMs | WAMs | — |
| [Consistency Models](../data/reports/ref-041a05059886890708fc.json) | Components of WAMs | Foundational work | 2023 |
| [Learning to summarize with human feedback](../data/reports/ref-066817e565cc911bd5c1.json) | Components of WAMs | Foundational work | 2020 |
| [High-Resolution Image Synthesis With Latent Diffusion Models](../data/reports/ref-07638f74c59962f3e906.json) | Components of WAMs | Components of WAMs | — |
| [DINOv3](../data/reports/ref-10cfc9a9bb6b6f4993db.json) | Components of WAMs | Components of WAMs | — |
| [Deep Reinforcement Learning from Human Preferences](../data/reports/ref-2062ffd7f6397312bd01.json) | Components of WAMs | Foundational work | 2017 |
| [Video generation models as world simulators](../data/reports/ref-2e934302c61e88be910f.json) | Components of WAMs | Components of WAMs | — |
| [Sigmoid Loss for Language Image Pre-Training](../data/reports/ref-308fa479bc3588a7d13a.json) | Components of WAMs | Components of WAMs | — |
| [Diffusion policy: Visuomotor policy learning via action diffusion](../data/reports/ref-393a36f38d60db8631f4.json) | Components of WAMs | Foundational work | 2023 |
| [Language Models are Few-Shot Learners](../data/reports/ref-41759d2ff12db0233ba2.json) | Components of WAMs | Components of WAMs | — |
| [CogVideoX: Text-to-Video Diffusion Models with An Expert Transformer](../data/reports/ref-46709651cfd0edc4993a.json) | Components of WAMs | Components of WAMs | — |
| [Genie: Generative Interactive Environments](../data/reports/ref-4d8794e1eba7bfc5be75.json) | Components of WAMs | Benchmarks & simulators | — |
| [DINO: DETR with Improved DeNoising Anchor Boxes for End-to-End Object Detection](../data/reports/ref-5514771916f15e54d7e6.json) | Components of WAMs | Related resources | — |
| [One-step Diffusion with Distribution Matching Distillation](../data/reports/ref-5c86e0d92b645b2b135f.json) | Components of WAMs | Foundational work | 2023 |
| [Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer](../data/reports/ref-626d1fe7536ab14c8fdc.json) | Components of WAMs | Components of WAMs | — |
| [EgoBridge: Domain Adaptation for Generalizable Imitation from Egocentric Human Data](../data/reports/ref-646db90b75f1827a347d.json) | Components of WAMs | Related resources | — |
| [Learning Transferable Visual Models From Natural Language Supervision](../data/reports/ref-6f620ba80d9567d982a6.json) | Components of WAMs | Components of WAMs | — |
| [LoRA: Low-Rank Adaptation of Large Language Models](../data/reports/ref-71811bf04d6371d0bd82.json) | Components of WAMs | Foundational work | 2021 |
| [DreamDojo: A Real-Time Robot World Model from Large-Scale Human Videos](../data/reports/ref-7e3d0c035bab4ff2d644.json) | Components of WAMs | WAMs | — |
| [Revisiting Sparse Rewards for Goal-Reaching Reinforcement Learning](../data/reports/ref-80d04bd5d03ee6f72663.json) | Components of WAMs | Foundational work | 2024 |
| [On-Policy Distillation of Language Models: Learning from Self-Generated Mistakes](../data/reports/ref-8432892bf821930fe230.json) | Components of WAMs | Foundational work | 2023 |
| [Improved Distribution Matching Distillation for Fast Image Synthesis](../data/reports/ref-8be34f0cf0d2ab79e166.json) | Components of WAMs | Foundational work | 2024 |
| [Diversity is all you need: Learning skills without a reward function](../data/reports/ref-8c0a34d0c6ab6b64e3ae.json) | Components of WAMs | Foundational work | 2018 |
| [Flow Straight and Fast: Learning to Generate and Transfer Data with Rectified Flow](../data/reports/ref-8c87d43c8563d21b1a7e.json) | Components of WAMs | Foundational work | 2022 |
| [Hierarchical Latent Action Model](../data/reports/ref-8ee63fbf3242512e5166.json) | Components of WAMs | VLA | — |
| [SERL: A Software Suite for Sample-Efficient Robotic Reinforcement Learning](../data/reports/ref-9beb9ce37b602d31a5d8.json) | Components of WAMs | Foundational work | 2024 |
| [Sim-to-Real Transfer of Robotic Control with Dynamics Randomization](../data/reports/ref-a3e337f84bff0522e5e1.json) | Components of WAMs | Foundational work | 2017 |
| [PointNet: Deep Learning on Point Sets for 3D Classification and Segmentation](../data/reports/ref-a6e65f34d4c161a2ba59.json) | Components of WAMs | Components of WAMs | — |
| [RLVR-World: Training World Models with Reinforcement Learning](../data/reports/ref-a8d6b1d31a7e72a424da.json) | Components of WAMs | WAMs | — |
| [FAST-LIVO2: Fast, Direct LiDAR-Inertial-Visual Odometry](../data/reports/ref-ae98866e6b155b0f253c.json) | Components of WAMs | Related resources | — |
| [Scalable Diffusion Models with Transformers](../data/reports/ref-b4155f59c47b47bdc94d.json) | Components of WAMs | Components of WAMs | — |
| [Generalized Predictive Model for Autonomous Driving](../data/reports/ref-baf06f1a599804c753fb.json) | Components of WAMs | WAMs | — |
| [Mixture-of-Transformers: A Sparse and Scalable Architecture for Multi-Modal Foundation Models](../data/reports/ref-c3cbdc6867eb310bf60b.json) | Components of WAMs | Components of WAMs | — |
| [Ctrl-World: A Controllable Generative World Model for Robot Manipulation](../data/reports/ref-c558ebadd23e762f0de7.json) | Components of WAMs | Benchmarks & simulators | — |
| [LIC-Fusion: LiDAR-Inertial-Camera Odometry](../data/reports/ref-c7de129d1b2c440e37ac.json) | Components of WAMs | Related resources | — |
| [Mean Flows for One-step Generative Modeling](../data/reports/ref-ce6916f81594a9c4c73f.json) | Components of WAMs | Foundational work | 2025 |
| [Precise and Dexterous Robotic Manipulation via Human-in-the-Loop Reinforcement Learning](../data/reports/ref-d54645624df87f5b0163.json) | Components of WAMs | Foundational work | 2024 |
| [Latent Action Pretraining from Videos](../data/reports/ref-d8b16d47d9d8bb62207f.json) | Components of WAMs | Components of WAMs | — |
| [PaLM-E: An Embodied Multimodal Language Model](../data/reports/ref-daaf554d1668f36b7aa3.json) | Components of WAMs | Components of WAMs | — |
| [Neural Discrete Representation Learning](../data/reports/ref-dacd62642bb5d66abc0c.json) | Components of WAMs | Components of WAMs | — |
| [DINOv2: Learning Robust Visual Features without Supervision](../data/reports/ref-e18cd2f0df3768294977.json) | Components of WAMs | Components of WAMs | — |
| [DriveDreamer-2: LLM-Enhanced World Models for Diverse Driving Video Generation](../data/reports/ref-eb71134f4ab2c037bb71.json) | Components of WAMs | Benchmarks & simulators | — |
| [3D Gaussian Splatting for Real-Time Radiance Field Rendering](../data/reports/ref-fccce46467ad720043ea.json) | Components of WAMs | Components of WAMs | — |
| [World Models](../data/reports/1803.10122.json) | Foundational work | Foundational work | 2018 |
| [BERT: A Review of Applications in Natural Language Processing and Understanding](../data/reports/2103.11943.json) | Foundational work | Not assigned | — |
| [The Role of World Models in Shaping Autonomous Driving: A Comprehensive Survey](../data/reports/2502.10498.json) | Foundational work | Related resources | — |
| [Critique of World Model](../data/reports/2507.05169.json) | Foundational work | Foundational work | 2025 |
| [HumanX: Toward Agile and Generalizable Humanoid Interaction Skills from Human Videos](../data/reports/2602.02473.json) | Foundational work | Datasets | — |
| [Learning to unfold cloth: Scaling up world models to deformable object manipulation](../data/reports/2602.16675.json) | Foundational work | WAMs | — |
| [LeWorldModel: Stable End-to-End Joint-Embedding Predictive Architecture from Pixels](../data/reports/2603.19312.json) | Foundational work | WAMs | — |
| [Toward Physically Consistent Driving Video World Models under Challenging Trajectories](../data/reports/2603.24506.json) | Foundational work | Benchmarks & simulators | — |
| [ActiveGlasses: Learning Manipulation with Active Vision from Ego-centric Human Demonstration](../data/reports/2604.08534.json) | Foundational work | Datasets | — |
| [World Model for Robot Learning: A Comprehensive Survey](../data/reports/2605.00080.json) | Foundational work | Related resources | — |
| [EA-WM: Event-Aware Generative World Model with Structured Kinematic-to-Visual Action Fields](../data/reports/2605.06192.json) | Foundational work | Benchmarks & simulators | — |
| [World Action Models: The Next Frontier in Embodied AI](../data/reports/2605.12090.json) | Foundational work | Related resources | — |
| [Unified Video-Action Joint Denoising for Dexterous Action and Data Generation](../data/reports/2606.03868.json) | Foundational work | WAMs | — |
| [Diffusion Transformer World-Action Model for AV Scene Prediction](../data/reports/2606.12987.json) | Foundational work | Benchmarks & simulators | — |
| [World Action Models: A Survey](../data/reports/2606.20781.json) | Foundational work | Related resources | — |
| [Attacking the Trusted Imagination: Oracle-Level Integrity Attacks on Imagine-then-Act World Models](../data/reports/2606.22966.json) | Foundational work | Related resources | — |
| [A Watermark for Vision-Language-Action and World Action Models](../data/reports/2606.23574.json) | Foundational work | Related resources | — |
| [Critique of Agent Model](../data/reports/2606.23991.json) | Foundational work | Related resources | — |
| [From World Models to World Action Models: A Concise Tutorial for Robotics](../data/reports/2607.00836.json) | Foundational work | Related resources | — |
| [From World Action Models to Embodied Brains: A Roadmap for Open-World Physical Intelligence](../data/reports/2607.11689.json) | Foundational work | Related resources | — |
| [BadWAM: When World-Action Models Dream Right but Act Wrong](../data/reports/2607.15207.json) | Foundational work | Related resources | — |
| [RoboHarness: Memory-Driven Orchestration of Heterogeneous Robot Policies for Long-Horizon Planning](../data/reports/2607.18060.json) | Foundational work | Related resources | — |
| [Data Pyramid for Embodied Manipulation: A Survey](../data/reports/2607.24744.json) | Foundational work | Related resources | — |
| [World Action Models in Real Time: An Empirical Study of Smooth Execution via Asynchronous Deployment](../data/reports/2608.01880.json) | Foundational work | Related resources | — |
| [Teach and Grow: An Agent-Centered Architecture for General Robot Learning](../data/reports/2608.17209.json) | Foundational work | Related resources | — |
| [Towards Surgical World-Action Modeling: A Preliminary Joint Visual-Trajectory Forecasting for Surgical Motion Planning](../data/reports/2608.20284.json) | Foundational work | WAMs | — |
| [On the Capability Separation Between World-Model Policy Learning and Imitated World-Action Models](../data/reports/2608.22197.json) | Foundational work | Related resources | — |
| [4DGS-WAM: Bridging Past and Future with an Object-Centric World Action Model based on 4D Gaussian Splatting](../data/reports/2608.25956.json) | Foundational work | WAMs | — |
| [Reinforcement Learning: An Introduction](../data/reports/ref-206bb9b995e39760f7d0.json) | Foundational work | Foundational work | 1998 |
| [Dream to Control: Learning Behaviors by Latent Imagination](../data/reports/ref-23813a5cbed0b2b6d37e.json) | Foundational work | Foundational work | 2019 |
| [Advancing AI for the physical world](../data/reports/ref-23e2ef710ce5722e25a2.json) | Foundational work | VLA | — |
| [Transformers are Sample-Efficient World Models](../data/reports/ref-355f71216b13cc8a4a3e.json) | Foundational work | Foundational work | 2022 |
| [DayDreamer: World Models for Physical Robot Learning](../data/reports/ref-35f4994d647876b8cec0.json) | Foundational work | Foundational work | 2022 |
| [Model predictive control: Theory and practice—A survey](../data/reports/ref-36bafee9274250697060.json) | Foundational work | Foundational work | 1989 |
| [Diffusion for World Modeling: Visual Details Matter in Atari](../data/reports/ref-3b350556ce83b51f84c8.json) | Foundational work | Foundational work | 2024 |
| [A Careful Examination of Large Behavior Models for Multitask Dexterous Manipulation](../data/reports/ref-3e8513f6b1b3fedf96e2.json) | Foundational work | VLA | — |
| [Probabilistic Robotics](../data/reports/ref-47f59ffa32a9f466d486.json) | Foundational work | Foundational work | 2005 |
| [Contrastive Learning as Goal-Conditioned Reinforcement Learning](../data/reports/ref-4db46d89f6231c67051e.json) | Foundational work | Foundational work | 2022 |
| [DrivingWorld: Constructing World Model for Autonomous Driving via Video GPT](../data/reports/ref-4e998454523b2100fbe1.json) | Foundational work | WAMs | — |
| [Planning and acting in partially observable stochastic domains](../data/reports/ref-55da7bc51e67237814d2.json) | Foundational work | Foundational work | 1998 |
| [Real-time humanoid motion generation through ZMP manipulation based on inverted pendulum control](../data/reports/ref-58789fde10c5f80c4c89.json) | Foundational work | Foundational work | 2002 |
| [A Survey on Vision-Language-Action Models for Autonomous Driving](../data/reports/ref-5d03f3be7549eb8453b0.json) | Foundational work | Related resources | — |
| [Learning Latent Dynamics for Planning from Pixels](../data/reports/ref-74afd84d073d16a0a3a1.json) | Foundational work | Foundational work | 2018 |
| [Rapid Exploration for Open-World Navigation with Latent Goal Models](../data/reports/ref-7874d48534f3bf22f87d.json) | Foundational work | Foundational work | 2021 |
| [DINO-WM: World Models on Pre-trained Visual Features enable Zero-shot Planning](../data/reports/ref-797a519828bd34873731.json) | Foundational work | Foundational work | 2024 |
| [Temporal Difference Learning for Model Predictive Control](../data/reports/ref-8a72842d518697e95077.json) | Foundational work | Foundational work | 2022 |
| [Mastering diverse control tasks through world models](../data/reports/ref-8fa0ebc722d8d35eaf75.json) | Foundational work | Foundational work | 2023 |
| [TD-MPC2: Scalable, Robust World Models for Continuous Control](../data/reports/ref-9fc7047b7d787fa298bf.json) | Foundational work | Foundational work | 2023 |
| [State Estimation for Robotics](../data/reports/ref-b116da337363048621f5.json) | Foundational work | Foundational work | 2017 |
| [Advances and applications of occupancy models](../data/reports/ref-b5a6c332a7beaf120245.json) | Foundational work | Not assigned | — |
| [Model-Based Reinforcement Learning for Atari](../data/reports/ref-b72f7e6ba4baaa80c600.json) | Foundational work | Foundational work | 2019 |
| [Towards Generalist Embodied AI: A Survey on World Models for VLA Agents](../data/reports/ref-c36572e136b3aca5087e.json) | Foundational work | Related resources | — |
| [AdaWorld: Learning Adaptable World Models with Latent Actions](../data/reports/ref-ca883d875395dd7ff120.json) | Foundational work | Foundational work | 2025 |
| [World Models via Policy-Guided Trajectory Diffusion](../data/reports/ref-da609a82e0cab3355273.json) | Foundational work | Foundational work | 2023 |
| [Factor Graphs for Robot Perception](../data/reports/ref-dcea01617aaebb6971e4.json) | Foundational work | Foundational work | 2017 |
| [Mastering Atari with Discrete World Models](../data/reports/ref-e1815cc67e6f9fc2bb7e.json) | Foundational work | Foundational work | 2020 |
| [When to Trust Your Model: Model-Based Policy Optimization](../data/reports/ref-e6aba3e8a3ffe044339d.json) | Foundational work | Foundational work | 2019 |
| [A review of learning-based dynamics models for robotic manipulation](../data/reports/ref-ea14fce8991bbd0da18e.json) | Foundational work | Related resources | — |
| [Monte-Carlo Planning in Large POMDPs](../data/reports/ref-f81b18b1d9818e0e2585.json) | Foundational work | Foundational work | 2010 |
| [RoboNet: Large-Scale Multi-Robot Learning](../data/reports/1910.11215.json) | Not assigned | Datasets | — |
| [Learning Universal Policies via Text-Guided Video Generation](../data/reports/2302.00111.json) | Not assigned | WAMs | — |
| [ RoboDreamer: Learning Compositional World Models for Robot Imagination](../data/reports/2404.12377.json) | Not assigned | WAMs | — |
| [Dreamitate: Real-World Visuomotor Policy Learning via Video Generation](../data/reports/2406.16862.json) | Not assigned | WAMs | — |
| [This&That: Language-Gesture Controlled Video Generation for Robot Planning](../data/reports/2407.05530.json) | Not assigned | WAMs | — |
| [DynaMo: In-Domain Dynamics Pretraining for Visuo-Motor Control](../data/reports/2409.12192.json) | Not assigned | Related resources | — |
| [Gen2Act: Human Video Generation in Novel Scenarios enables Generalizable Robot Manipulation](../data/reports/2409.16283.json) | Not assigned | WAMs | — |
| [Scaling Offline Model-Based RL via Jointly-Optimized World-Action Model Pretraining](../data/reports/2410.00564.json) | Not assigned | Foundational work | 2024 |
| [EnerVerse: Envisioning Embodied Future Space for Robotics Manipulation](../data/reports/2501.01895.json) | Not assigned | WAMs | — |
| [VideoWorld: Exploring Knowledge Learning from Unlabeled Videos](../data/reports/2501.09781.json) | Not assigned | WAMs | — |
| [VILP: Imitation Learning with Latent Video Planning](../data/reports/2502.01784.json) | Not assigned | WAMs | — |
| [LUMOS: Language-Conditioned Imitation Learning with World Models](../data/reports/2503.10370.json) | Not assigned | WAMs | — |
| [CoT-VLA: Visual Chain-of-Thought Reasoning for Vision-Language-Action Models](../data/reports/2503.22020.json) | Not assigned | WAMs | — |
| [CLAM: Continuous Latent Action Models for Robot Learning from Unlabeled Demonstrations](../data/reports/2505.04999.json) | Not assigned | Related resources | — |
| [UniVLA: Learning to Act Anywhere with Task-centric Latent Actions](../data/reports/2505.06111.json) | Not assigned | VLA | — |
| [EWMBench: Evaluating Scene, Motion, and Semantic Quality in Embodied World Models](../data/reports/2505.09694.json) | Not assigned | Benchmarks & simulators | — |
| [EnerVerse-AC: Envisioning Embodied Environments with Action Condition](../data/reports/2505.09723.json) | Not assigned | Benchmarks & simulators | — |
| [FLARE: Robot Learning with Implicit World Modeling](../data/reports/2505.15659.json) | Not assigned | WAMs | — |
| [WorldEval: World Model as Real-World Robot Policies Evaluator](../data/reports/2505.19017.json) | Not assigned | Benchmarks & simulators | — |
| [Learning Generalizable Robot Policy with Human Demonstration Video as a Prompt](../data/reports/2505.20795.json) | Not assigned | Related resources | — |
| [RoboTransfer: Controllable Geometry-Consistent Video Diffusion for Manipulation Policy Transfer](../data/reports/2505.23171.json) | Not assigned | Datasets | — |
| [Towards a Generalizable Bimanual Foundation Policy via Flow-based Video Prediction](../data/reports/2505.24156.json) | Not assigned | WAMs | — |
| [3DFlowAction: Learning Cross-Embodiment Manipulation from 3D Flow World Model](../data/reports/2506.06199.json) | Not assigned | WAMs | — |
| [AMPLIFY: Actionless Motion Priors for Robot Learning from Videos](../data/reports/2506.14198.json) | Not assigned | WAMs | — |
| [RoboScape: Physics-informed Embodied World Model](../data/reports/2506.23135.json) | Not assigned | Benchmarks & simulators | — |
| [DreamVLA: A Vision-Language-Action Model Dreamed with Comprehensive World Knowledge](../data/reports/2507.04447.json) | Not assigned | WAMs | — |
| [Vidar: Embodied Video Diffusion Model for Generalist Manipulation](../data/reports/2507.12898.json) | Not assigned | WAMs | — |
| [MimicDreamer: Aligning Human and Robot Demonstrations for Scalable VLA Training](../data/reports/2509.22199.json) | Not assigned | Datasets | — |
| [Generative World Modelling for Humanoids: 1X World Model Challenge Technical Report](../data/reports/2510.07092.json) | Not assigned | Benchmarks & simulators | — |
| [Dual-Stream Diffusion for World-Model Augmented Vision-Language-Action Model](../data/reports/2510.27607.json) | Not assigned | WAMs | — |
| [RynnVLA-002: A Unified Vision-Language-Action and World Model](../data/reports/2511.17502.json) | Not assigned | WAMs | — |
| [Learning Massively Multitask World Models for Continuous Control](../data/reports/2511.19584.json) | Not assigned | WAMs | — |
| [LatBot: Distilling Universal Latent Actions for Vision-Language-Action Models](../data/reports/2511.23034.json) | Not assigned | VLA | — |
| [Video2Act: A Dual-System Video Diffusion Policy with Robotic Spatio-Motional Modeling](../data/reports/2512.03044.json) | Not assigned | VLA | — |
| [MindDrive: An All-in-One Framework Bridging World Models and Vision-Language Model for End-to-End Autonomous Driving](../data/reports/2512.04441.json) | Not assigned | WAMs | — |
| [VideoVLA: Video Generators Can Be Generalizable Robot Manipulators](../data/reports/2512.06963.json) | Not assigned | WAMs | — |
| [WorldLens: Full-Spectrum Evaluations of Driving World Models in Real World](../data/reports/2512.10958.json) | Not assigned | Benchmarks & simulators | — |
| [CoVAR: Co-generation of Video and Action for Robotic Manipulation via Multi-Modal Diffusion](../data/reports/2512.16023.json) | Not assigned | WAMs | — |
| [Dream2Flow: Bridging Video Generation and Open-World Manipulation with 3D Object Flow](../data/reports/2512.24766.json) | Not assigned | WAMs | — |
| [Wow, wo, val! A Comprehensive Embodied World Model Evaluation Turing Test](../data/reports/2601.04137.json) | Not assigned | Benchmarks & simulators | — |
| [VideoWorld 2: Learning Transferable Knowledge from Real-world Videos](../data/reports/2602.10102.json) | Not assigned | VLA | — |
| [Factored Latent Action World Models](../data/reports/2602.16229.json) | Not assigned | Related resources | — |
| [Self-Correcting VLA: Online Action Refinement via Sparse World Imagination](../data/reports/2602.21633.json) | Not assigned | WAMs | — |
| [VTAM: Video-Tactile-Action Models for Complex Physical Interaction Beyond VLAs](../data/reports/2603.23481.json) | Not assigned | WAMs | — |
| [Vega: Learning to Drive with Natural Language Instructions](../data/reports/2603.25741.json) | Not assigned | WAMs | — |
| [ManipArena: A Controlled Benchmark for Diagnosing Generalization in Real-Robot Manipulation](../data/reports/2603.28545.json) | Not assigned | Benchmarks & simulators | — |
| [Enhancing Policy Learning with World-Action Model](../data/reports/2603.28955.json) | Not assigned | WAMs | — |
| [DriveDreamer-Policy: A Geometry-Grounded World-Action Model for Unified Generation and Planning](../data/reports/2604.01765.json) | Not assigned | WAMs | — |
| [JailWAM: Jailbreaking World Action Models in Robot Control](../data/reports/2604.05498.json) | Not assigned | Benchmarks & simulators | — |
| [VAG: Dual-Stream Video-Action Generation for Embodied Data Synthesis](../data/reports/2604.09330.json) | Not assigned | WAMs | — |
| [AIM: Intent-Aware Unified world action Modeling with Spatial Value Maps](../data/reports/2604.11135.json) | Not assigned | WAMs | — |
| [DexWorldModel: Causal Latent World Modeling towards Automated Learning of Embodied Tasks](../data/reports/2604.16484.json) | Not assigned | WAMs | — |
| [RoboWM-Bench: A Benchmark for Evaluating World Models in Robotic Manipulation](../data/reports/2604.19092.json) | Not assigned | Benchmarks & simulators | — |
| [Privileged Foresight Distillation: Zero-Cost Future Correction for World Action Models](../data/reports/2604.25859.json) | Not assigned | WAMs | — |
| [Unified 4D World Action Modeling from Video Priors with Asynchronous Denoising](../data/reports/2604.26694.json) | Not assigned | WAMs | — |
| [Motubrain: An Advanced World Action Model for Robot Control](../data/reports/2604.27792.json) | Not assigned | WAMs | — |
| [Being-H0.7: A Latent World-Action Model from Egocentric Videos](../data/reports/2605.00078.json) | Not assigned | WAMs | — |
| [What Matters for Latent Actions in Robot Learning](../data/reports/2608.19613.json) | Not assigned | VLA | — |
| [Latent Energy Action Planning with World Models](../data/reports/2609.03294.json) | Not assigned | WAMs | — |
| [Building Pretraining Data for World Models: An Unreal Engine-Based Pipeline for Action-Conditioned Video Generation](../data/reports/2609.03557.json) | Not assigned | Datasets | — |
| [Toward Physically Grounded JEPA World Models for Goal-Conditioned Robotic Planning](../data/reports/2609.03565.json) | Not assigned | WAMs | — |
| [Drive-HWM: Hierarchical World Models for Dynamic-Latent Guided Autonomous Driving](../data/reports/2609.03572.json) | Not assigned | WAMs | — |
| [SV-WAM: An Efficient Surround-View World-Action Model for End-to-End Autonomous Driving](../data/reports/2609.03602.json) | Not assigned | WAMs | — |
| [WISE: World-model-guided Imagination Scheduling for Efficient Post-training of Vision-Language-Action Models](../data/reports/2609.03681.json) | Not assigned | WAMs | — |
| [Toward Unified Robot Learning: Bridging Representation, Vision-Language-Action, and World Models](../data/reports/2609.03927.json) | Not assigned | Related resources | — |
| [GIFT: Guided Intermediate Feature Training via Action-Oriented Structural Supervision for Robotic Manipulation](../data/reports/2609.04193.json) | Not assigned | WAMs | — |
| [TourPhysics: Bringing Physics to World Models for Exploration and Manipulation from a Single Image](../data/reports/2609.04911.json) | Not assigned | Benchmarks & simulators | — |
| [TacPAC: Tactile Prediction and Real-Time Action Correction in World-Action Models for Contact-Rich Manipulation](../data/reports/2609.05266.json) | Not assigned | WAMs | — |
| [GE-Act 2.0: Pretraining and Scaling a World-Action Model for Robotic Manipulation](../data/reports/2609.05588.json) | Not assigned | WAMs | — |
| [Learning Counterfactual World Models for Embodied Reasoning under Partial Observability](../data/reports/2609.05834.json) | Not assigned | WAMs | — |
| [How to Learn from What a Human Would Avoid? Intervention-Aware World Models with Real-World RL for Dexterous Manipulation](../data/reports/2609.06009.json) | Not assigned | WAMs | — |
| [Learning to Use Imagination: Progress-Conditioned Future Utilization for World Action Models](../data/reports/2609.06578.json) | Not assigned | WAMs | — |
| [WM-Craftnet: World Synesthesia Model for Generalizable and Robust Dexterous In-Hand Manipulation](../data/reports/2609.07002.json) | Not assigned | WAMs | — |
| [Beyond Task Success: Stage-Wise Reliability of World Model Planning under Sensing Degradation](../data/reports/2609.07126.json) | Not assigned | Evaluation metrics | — |
| [OpenWAM: An Open, Modular Exploration Towards Systematic World-Action Model Pretraining](../data/reports/2609.07398.json) | Not assigned | WAMs | — |
| [WorldAgen: Unified State-Action Prediction with Test-Time World Model Training](../data/reports/2609.08162.json) | Not assigned | WAMs | — |
| [SyncWorld: Visual Calibration Enables World Models as Zero-Shot Simulators](../data/reports/2609.09155.json) | Not assigned | WAMs | — |
| [Valerant: An Automatic Navigable Game Map Generator via Action-Conditioned World Model Exploration](../data/reports/2609.09418.json) | Not assigned | Related resources | — |
| [Compact Visuotactile World Models for Lifting: Prediction, Reward Alignment, and Force Constraints](../data/reports/2609.09597.json) | Not assigned | WAMs | — |
| [JEPA Policy: Diffusion-Free Imitation Learning via Paired Action and Future Representation Prediction](../data/reports/2609.09630.json) | Not assigned | WAMs | — |
| [HaWMPO: Hallucination-Aware World Model-based Policy Optimization for Generalist Robot Policy](../data/reports/2609.09941.json) | Not assigned | WAMs | — |
| [Grounding Generated Video Plans in Simulation Towards Versatile Dexterous Controllers](../data/reports/2609.10050.json) | Not assigned | WAMs | — |
| [FolDeX: A Physical-World Benchmark for Long-Horizon Robotic Manipulation of Deformable Objects](../data/reports/2609.10243.json) | Not assigned | Benchmarks & simulators | — |
| [DUET-DINO: Simultaneous Cross-View World Modeling for Latent Planning in Robot Manipulation](../data/reports/2609.10506.json) | Not assigned | WAMs | — |
| [Programmable World Model](../data/reports/2609.10540.json) | Not assigned | Benchmarks & simulators | — |

## First-release evidence for Foundational work

- **Diffusion Policy (2023):** The authors' project page identifies the original RSS 2023 paper and its later IJRR extension, with matching titles and the corresponding author lists. Existing report evidence `e-identity` explicitly traces the journal edition to the 2023 RSS work. [Author project and publication history](https://diffusion-policy.cs.columbia.edu/).
- **Consistency Models (2023):** [Official arXiv record](https://arxiv.org/abs/2303.01469), Submission history, [v1]: 2 March 2023. The observed title and author identities match this catalog work and its existing primary report. This is the earliest public-preprint year shown by the primary revision history, rather than the later venue or revised-PDF year. Checked 2026-09-13.
- **Learning to summarize with human feedback (2020):** [Official arXiv record](https://arxiv.org/abs/2009.01325), Submission history, [v1]: 2 September 2020. The observed title and author identities match this catalog work and its existing primary report. This is the earliest public-preprint year shown by the primary revision history, rather than the later venue or revised-PDF year. Checked 2026-09-13. The source title uses “from human feedback”; the catalog uses “with human feedback”, an already documented wording discrepancy.
- **Deep Reinforcement Learning from Human Preferences (2017):** [Official arXiv record](https://arxiv.org/abs/1706.03741), Submission history, [v1]: 12 June 2017. The observed title and author identities match this catalog work and its existing primary report. This is the earliest public-preprint year shown by the primary revision history, rather than the later venue or revised-PDF year. Checked 2026-09-13.
- **One-step Diffusion with Distribution Matching Distillation (2023):** [Official arXiv record](https://arxiv.org/abs/2311.18828), Submission history, [v1]: 30 November 2023. The observed title and author identities match this catalog work and its existing primary report. This is the earliest public-preprint year shown by the primary revision history, rather than the later venue or revised-PDF year. Checked 2026-09-13.
- **LoRA: Low-Rank Adaptation of Large Language Models (2021):** [Official arXiv record](https://arxiv.org/abs/2106.09685), Submission history, [v1]: 17 June 2021. The observed title and author identities match this catalog work and its existing primary report. This is the earliest public-preprint year shown by the primary revision history, rather than the later venue or revised-PDF year. Checked 2026-09-13.
- **Revisiting Sparse Rewards for Goal-Reaching Reinforcement Learning (2024):** [Official arXiv record](https://arxiv.org/abs/2407.00324), Submission history, [v1]: 29 June 2024. The observed title and author identities match this catalog work and its existing primary report. This is the earliest public-preprint year shown by the primary revision history, rather than the later venue or revised-PDF year. Checked 2026-09-13.
- **On-Policy Distillation of Language Models: Learning from Self-Generated Mistakes (2023):** [Official arXiv record](https://arxiv.org/abs/2306.13649), Submission history, [v1]: 23 June 2023. The observed title and author identities match this catalog work and its existing primary report. This is the earliest public-preprint year shown by the primary revision history, rather than the later venue or revised-PDF year. Checked 2026-09-13.
- **Improved Distribution Matching Distillation for Fast Image Synthesis (2024):** [Official arXiv record](https://arxiv.org/abs/2405.14867), Submission history, [v1]: 23 May 2024. The observed title and author identities match this catalog work and its existing primary report. This is the earliest public-preprint year shown by the primary revision history, rather than the later venue or revised-PDF year. Checked 2026-09-13.
- **Diversity is all you need: Learning skills without a reward function (2018):** [Official arXiv record](https://arxiv.org/abs/1802.06070), Submission history, [v1]: 16 February 2018. The observed title and author identities match this catalog work and its existing primary report. This is the earliest public-preprint year shown by the primary revision history, rather than the later venue or revised-PDF year. Checked 2026-09-13.
- **Flow Straight and Fast: Learning to Generate and Transfer Data with Rectified Flow (2022):** [Official arXiv record](https://arxiv.org/abs/2209.03003), Submission history, [v1]: 7 September 2022. The observed title and author identities match this catalog work and its existing primary report. This is the earliest public-preprint year shown by the primary revision history, rather than the later venue or revised-PDF year. Checked 2026-09-13.
- **SERL: A Software Suite for Sample-Efficient Robotic Reinforcement Learning (2024):** [Official arXiv record](https://arxiv.org/abs/2401.16013), Submission history, [v1]: 29 January 2024. The observed title and author identities match this catalog work and its existing primary report. This is the earliest public-preprint year shown by the primary revision history, rather than the later venue or revised-PDF year. Checked 2026-09-13.
- **Sim-to-Real Transfer of Robotic Control with Dynamics Randomization (2017):** [Official arXiv record](https://arxiv.org/abs/1710.06537), Submission history, [v1]: 18 October 2017. The observed title and author identities match this catalog work and its existing primary report. This is the earliest public-preprint year shown by the primary revision history, rather than the later venue or revised-PDF year. Checked 2026-09-13.
- **Mean Flows for One-step Generative Modeling (2025):** [Official arXiv record](https://arxiv.org/abs/2505.13447), Submission history, [v1]: 19 May 2025. The observed title and author identities match this catalog work and its existing primary report. This is the earliest public-preprint year shown by the primary revision history, rather than the later venue or revised-PDF year. Checked 2026-09-13.
- **Precise and Dexterous Robotic Manipulation via Human-in-the-Loop Reinforcement Learning (2024):** [Official arXiv record](https://arxiv.org/abs/2410.21845), Submission history, [v1]: 29 October 2024. The observed title and author identities match this catalog work and its existing primary report. This is the earliest public-preprint year shown by the primary revision history, rather than the later venue or revised-PDF year. Checked 2026-09-13.
- **World Models (2018):** World Models; David Ha (Google Brain) and Jürgen Schmidhuber (NNAISENSE; Swiss AI Lab, IDSIA (USI & SUPSI)); arXiv:1803.10122v4, 9 May 2018. [Primary source](https://arxiv.org/pdf/1803.10122).
- **Critique of World Model (2025):** Version 1 was submitted 7 July 2025. The v1 abstract already describes action-dependent simulation and a hierarchical mixed-representation PAN proposal; the current report reads the later v5. [Primary source](https://arxiv.org/abs/2507.05169v1).
- **Reinforcement Learning: An Introduction (1998):** Both primary title blocks give Reinforcement Learning: An Introduction and Richard S. Sutton and Andrew G. Barto. The landing page explicitly gives First Edition, MIT Press, Cambridge, MA, 1998 and distinguishes a linked second edition. The ebook contents place Planning and Learning in Chapter 9. [Primary source](http://incompleteideas.net/book/the-book-1st.html).
- **Dream to Control: Learning Behaviors by Latent Imagination (2019):** Official arXiv original submission: 3 December 2019; ICLR 2020 publication and March 2020 v3 followed. [Primary source](https://arxiv.org/abs/1912.01603).
- **Transformers are Sample-Efficient World Models (2022):** Official arXiv original submission: 1 September 2022; ICLR publication and reviewed revision followed in 2023. [Primary source](https://arxiv.org/abs/2209.00588).
- **DayDreamer: World Models for Physical Robot Learning (2022):** The title is DayDreamer: World Models for Physical Robot Learning. The author order is Philipp Wu, Alejandro Escontrela, Danijar Hafner, Ken Goldberg, Pieter Abbeel; the first three have equal-contribution marks. The affiliation is University of California, Berkeley. The artifact is arXiv:2206.14176v1, dated 28 June 2022. [Primary source](https://arxiv.org/pdf/2206.14176).
- **Model predictive control: Theory and practice—A survey (1989):** Automatica volume 25, issue 3, May 1989, pages 335–348; DOI 10.1016/0005-1098(89)90002-2. [Primary source](https://www.sciencedirect.com/science/article/pii/0005109889900022).
- **Diffusion for World Modeling: Visual Details Matter in Atari (2024):** Primary PDF is in the official NeurIPS 2024 proceedings; report e01 identifies it as the accepted final version. [Primary source](https://proceedings.neurips.cc/paper_files/paper/2024/file/6bdde0373d53d4a501249547084bed43-Paper-Conference.pdf).
- **Probabilistic Robotics (2005):** MIT Press lists publication date 19 August 2005 for ISBN 9780262201629. [Primary source](https://mitpress.mit.edu/9780262201629/probabilistic-robotics/).
- **Contrastive Learning as Goal-Conditioned Reinforcement Learning (2022):** Exact title and credits: Benjamin Eysenbach; Tianjun Zhang; Sergey Levine; Ruslan Salakhutdinov. Affiliations: CMU; Google Research; UC Berkeley. Footer: NeurIPS 2022. Introduction frames representation learning as the RL algorithm itself. [Primary source](https://proceedings.neurips.cc/paper/2022/file/e7663e974c4ee7a2b475a4775201ce1f-Paper-Conference.pdf).
- **Planning and acting in partially observable stochastic domains (1998):** The observed title and all three authors match the catalog. The title page identifies Artificial Intelligence 101 (1998), 99–134, PII S0004-3702(98)00023-X, received 11 October 1995 and revised 17 January 1998; the affiliations are Brown University, Duke University and MCC. [Primary source](https://people.csail.mit.edu/lpk/papers/aij98-pomdp.pdf).
- **Real-time humanoid motion generation through ZMP manipulation based on inverted pendulum control (2002):** Sugihara-coauthored Foot-guided control of a biped robot through ZMP manipulation cites the exact title as ICRA 2002, pp. 1404–1409. Direct IEEE page returned robots restriction; existing source report verifies original method identity. [Primary source](https://www.tandfonline.com/doi/full/10.1080/01691864.2020.1827031).
- **Learning Latent Dynamics for Planning from Pixels (2018):** Official arXiv original submission: 12 November 2018; ICML 2019 publication and reviewed revision followed. [Primary source](https://arxiv.org/abs/1811.04551).
- **Rapid Exploration for Open-World Navigation with Latent Goal Models (2021):** Official arXiv original submission: 12 April 2021; CoRL 2021 proceedings were published as PMLR volume 164 in 2022. [Primary source](https://arxiv.org/abs/2104.05859).
- **DINO-WM: World Models on Pre-trained Visual Features enable Zero-shot Planning (2024):** Official arXiv original submission: 7 November 2024; the report reads v2 dated 1 February 2025. [Primary source](https://arxiv.org/abs/2411.04983).
- **Temporal Difference Learning for Model Predictive Control (2022):** Official arXiv original submission: 9 March 2022; ICML 2022 proceedings provide the reviewed primary version. [Primary source](https://arxiv.org/abs/2203.04955).
- **Mastering diverse control tasks through world models (2023):** The same DreamerV3 method and author group first appeared as Mastering Diverse Domains through World Models on 10 January 2023. Its linked author project page now presents the Nature article Mastering Diverse Control Tasks through World Models (2025). The audited full-text report reads the Nature version. [Primary source](https://arxiv.org/abs/2301.04104).
- **TD-MPC2: Scalable, Robust World Models for Continuous Control (2023):** Official arXiv original submission: 25 October 2023; the report reads the 2024 revision. [Primary source](https://arxiv.org/abs/2310.16828).
- **State Estimation for Robotics (2017):** The author PDF revision history (PDF p. 3) identifies 13 May 2017 as the version best matching the published first edition. The reviewed compilation is dated 2022; catalog year 2024 refers to the second edition. [Primary source](https://asrl.utias.utoronto.ca/~tdb/bib/barfoot_ser17.pdf).
- **Model-Based Reinforcement Learning for Atari (2019):** Official arXiv original submission: 1 March 2019; ICLR 2020 publication and 2024 reviewed revision followed. [Primary source](https://arxiv.org/abs/1903.00374).
- **AdaWorld: Learning Adaptable World Models with Latent Actions (2025):** Official arXiv original submission: 24 March 2025; ICML proceedings followed in 2025. [Primary source](https://arxiv.org/abs/2503.18938).
- **World Models via Policy-Guided Trajectory Diffusion (2023):** Official arXiv original submission: 13 December 2023; the report reads v4 dated 27 March 2024. [Primary source](https://arxiv.org/abs/2312.08533).
- **Factor Graphs for Robot Perception (2017):** Exact title: Factor Graphs for Robot Perception. Authors: Frank Dellaert, Georgia Institute of Technology; Michael Kaess, Carnegie Mellon University. The block identifies the 2017 journal volume, printed page range and DOI. [Primary source](https://www.cs.cmu.edu/~kaess/pub/Dellaert17fnt.pdf).
- **Mastering Atari with Discrete World Models (2020):** Official arXiv original submission: 5 October 2020; ICLR 2021 publication and 2022 v4 followed. [Primary source](https://arxiv.org/abs/2010.02193).
- **When to Trust Your Model: Model-Based Policy Optimization (2019):** The observed title matches the catalog. Authors are Michael Janner, Justin Fu, Marvin Zhang and Sergey Levine, affiliated with University of California, Berkeley; the footer identifies NeurIPS 2019. [Primary source](https://proceedings.neurips.cc/paper/2019/file/5faf461eff3099671ad63c6f3f094f7f-Paper.pdf).
- **Monte-Carlo Planning in Large POMDPs (2010):** Official proceedings source is NeurIPS 2010. The PDF title/author evidence e01 has no printed date; year is obtained from its official proceedings publication context. [Primary source](https://proceedings.neurips.cc/paper/2010/file/edfbe1afcf9246bb0d40eb4d8027d90f-Paper.pdf).
- **Scaling Offline Model-Based RL via Jointly-Optimized World-Action Model Pretraining (2024):** The official arXiv page identifies this title and the same eight authors, with v1 submitted 1 October 2024 at 10:25:03 UTC. It lists ICLR 2025 acceptance and v4 revision on 29 January 2026. The later reviewed revision does not change the first publication year. [Primary source](https://arxiv.org/abs/2410.00564).

## Synchronization

Version 2 reviews are reapplied after Notion and local discoveries are merged. A source export cannot silently revert a reviewed WAM to Foundational work or reintroduce unchecked Components. Bibliographic updates still flow through. New entries in these two curated categories require explicit review; source-report hashes and evidence IDs are validated before building.
