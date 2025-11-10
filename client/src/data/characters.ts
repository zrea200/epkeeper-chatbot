export interface Character {
  id: string;
  name: string;
  title: string;
  description: string;
  greeting: string;
  avatar: string; // 聊天消息中的小头像
  displayAvatar: string; // 主页展示的大图
  bgColor: string; // 背景颜色 CSS class
  accentColor: string; // 强调色 hex
  animations: {
    speaking: string; // 说话状态动画
    thinking: string; // 思考状态动画
    listening: string; // 聆听状态动画
    idle: string; // 默认/空闲状态动画
  };
}

export const characters: Character[] = [
  {
    id: 'escort',
    name: '电小二',
    title: '智能管家',
    description: '专业的智能管家团队，为您提供全方位的电力运维保障',
    greeting: '你好！我是电管家的智能管家。我们致力于为您提供最专业的电力运维服务。请问有什么我可以帮助您的吗？',
    avatar: '/avatars/Asset3@4x.png',
    displayAvatar: '/avatars/Asset3@4x.png',
    bgColor: '#F2ECC9',
    accentColor: '#F3D621',
    animations: {
      speaking: '/lottie/er-speak.json',
      thinking: '/lottie/er-think.json',
      listening: '/lottie/er-think.json',
      idle: '/lottie/er-think.json',
    },
  },
  {
    id: 'leader',
    name: '电盟主',
    title: '能源专家',
    description: '资深能源专家，为您解答电力能源的各种问题',
    greeting: '欢迎来到电管家！我是您的能源专家。我可以为您详细介绍我们的各项服务。请问您想了解什么呢？',
    avatar: '/avatars/Asset4@4x.png',
    displayAvatar: '/avatars/Asset4@4x.png',
    bgColor: '#C2DBE7',
    accentColor: '#2980AE',
    animations: {
      speaking: '/lottie/el-speak.json',
      thinking: '/lottie/el-think.json',
      listening: '/lottie/el-think.json',
      idle: '/lottie/el-think.json',
    },
  },
];

export function getDefaultCharacter(): Character {
  return characters[0];
}

export function getCharacterById(id: string): Character | undefined {
  return characters.find((c) => c.id === id);
}
