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
}

export const characters: Character[] = [
  {
    id: 'escort',
    name: '电护卫',
    title: '安全护卫',
    description: '专业的安全护卫团队，为您提供全方位的电力运维保障',
    greeting: '你好！我是电管家的安全护卫。我们致力于为您提供最专业的电力运维服务。请问有什么我可以帮助您的吗？',
    avatar: '/avatars/Asset7@4x.png',
    displayAvatar: '/avatars/Asset7@4x.png',
    bgColor: 'from-blue-50 to-cyan-50',
    accentColor: '#1B7FD6',
  },
  {
    id: 'leader',
    name: '工人',
    title: '能源顾问',
    description: '资深能源顾问，为您解答电力能源的各种问题',
    greeting: '欢迎来到电管家！我是您的能源顾问。我可以为您详细介绍我们的各项服务。请问您想了解什么呢？',
    avatar: '/avatars/Asset1@4x.png',
    displayAvatar: '/avatars/Asset4@4x.png',
    bgColor: 'from-amber-50 to-orange-50',
    accentColor: '#FA8C16',
  },
  {
    id: 'scientist',
    name: '电博士',
    title: '技术专家',
    description: '技术专家团队，深入讲解电力技术和创新方案',
    greeting: '您好！我是电管家的技术专家。我对电力技术有深入的研究。有什么技术问题我可以为您解答吗？',
    avatar: '/avatars/Asset9@4x.png',
    displayAvatar: '/avatars/Asset9@4x.png',
    bgColor: 'from-green-50 to-lime-50',
    accentColor: '#52C41A',
  },
  {
    id: 'worker',
    name: '领导',
    title: '运维工程师',
    description: '经验丰富的运维工程师，为您解决实际问题',
    greeting: '你好！我是电管家的运维工程师。我在电力运维方面有丰富的实战经验。有什么问题我可以帮您解决吗？',
    avatar: '/avatars/Asset2@4x.png',
    displayAvatar: '/avatars/Asset3@4x.png',
    bgColor: 'from-blue-50 to-indigo-50',
    accentColor: '#1890FF',
  },
  {
    id: 'doctor',
    name: '电医生',
    title: '健康监测',
    description: '电力系统健康监测专家，为您的电力系统把脉诊断',
    greeting: '欢迎！我是电管家的系统诊断专家。我可以为您的电力系统进行全面的健康检查。请告诉我您的需求吧！',
    avatar: '/avatars/Asset6@4x.png',
    displayAvatar: '/avatars/Asset11@4x.png',
    bgColor: 'from-red-50 to-orange-50',
    accentColor: '#F5222D',
  },
];

export function getDefaultCharacter(): Character {
  return characters[0];
}

export function getCharacterById(id: string): Character | undefined {
  return characters.find((c) => c.id === id);
}
