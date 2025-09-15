interface WhyBoardIconProps {
  size?: number;
  className?: string;
}

export default function WhyBoardIcon({ size = 40, className = "" }: WhyBoardIconProps) {
  return (
    <div 
      className={`bg-blue-100 rounded-xl flex items-center justify-center shadow-lg ${className}`}
      style={{ width: size, height: size }}
    >
      <svg 
        width={size * 0.8} 
        height={size * 0.6} 
        viewBox="0 0 32 24" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* WHYテキスト */}
        <text 
          x="16" 
          y="21" 
          fontFamily="Arial, sans-serif" 
          fontSize="25" 
          fontWeight="bold" 
          fill="black" 
          textAnchor="middle"
        >
          ?
        </text>
      </svg>
    </div>
  );
}