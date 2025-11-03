import { Character } from '@/data/characters';
import { useEffect, useState } from 'react';

interface AnimatedAvatarProps {
  character: Character;
  width?: number;
  height?: number;
}

export default function AnimatedAvatar({
  character,
  width = 280,
  height = 350,
}: AnimatedAvatarProps) {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setRotation((prev) => (prev + 1) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="relative flex items-center justify-center rounded-3xl shadow-lg overflow-hidden"
      style={{
        width,
        height,
        background: `linear-gradient(135deg, ${character.accentColor}20 0%, ${character.accentColor}10 100%)`,
      }}
    >
      {/* 背景装饰 */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-20 h-20 bg-white rounded-full blur-xl"></div>
        <div className="absolute bottom-10 right-10 w-32 h-32 bg-white rounded-full blur-2xl"></div>
      </div>

        {/* 主头像容器 */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        {/* 旋转的外圈 */}
        <div
          className="absolute w-48 h-48 rounded-full border-4 border-white border-opacity-30"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: 'transform 0.05s linear',
          }}
        ></div>

        {/* 中心头像 */}
        <div className="relative w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-xl overflow-hidden">
          <img
            src={character.avatar}
            alt={character.name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* 装饰点 */}
        <div
          className="absolute w-3 h-3 bg-white rounded-full opacity-60"
          style={{
            top: '20%',
            left: '15%',
            transform: `rotate(${rotation * 2}deg) translateX(80px)`,
            transformOrigin: 'center',
            transition: 'transform 0.05s linear',
          }}
        ></div>
        <div
          className="absolute w-3 h-3 bg-white rounded-full opacity-60"
          style={{
            top: '20%',
            right: '15%',
            transform: `rotate(${rotation * 2}deg) translateX(-80px)`,
            transformOrigin: 'center',
            transition: 'transform 0.05s linear',
          }}
        ></div>
      </div>

      {/* 底部光效 */}
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-full h-24 bg-gradient-to-t from-black/20 to-transparent"></div>
    </div>
  );
}
