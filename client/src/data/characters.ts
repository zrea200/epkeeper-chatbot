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
    displayAvatar: '/avatars/Asset2.png',
    bgColor: '#FFFFFF',
    accentColor: '#F3D621',
    animations: {
      speaking: '/lottie2/2-speak.lottie',
      thinking: '/lottie2/2-think.lottie',
      listening: '/lottie2/2-liste.lottie',
      idle: '/avatars/Asset2.png',
    },
  },
  {
    id: 'leader',
    name: '电小虎',
    title: '智能微电网运营小助手',
    description: '资深能源专家，为您解答电力能源的各种问题',
    greeting: '你好！我是电管家的智能管家。我们致力于为您提供最专业的电力运维服务。请问有什么我可以帮助您的吗？',
    avatar: '/avatars/Asset4@4x.png',
    displayAvatar: '/avatars/Asset1.png',
    bgColor: '#FFFFFF',
    accentColor: '#2980AE',
    animations: {
      speaking: '/lottie2/1-speak.lottie',
      thinking: '/lottie2/1-think.lottie',
      listening: '/lottie2/1-listening.lottie',
      idle: '/avatars/Asset1.png', 
    },
  },
];

export function getDefaultCharacter(): Character {
  // 默认使用电小虎 (leader)
  return characters.find(c => c.id === 'leader') || characters[0];
}

export function getCharacterById(id: string): Character | undefined {
  return characters.find((c) => c.id === id);
}
