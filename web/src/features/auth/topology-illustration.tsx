const NODES = [
  { x: 72, y: 62, label: "CRM", tone: "var(--success)" },
  { x: 408, y: 62, label: "ERP", tone: "var(--success)" },
  { x: 56, y: 180, label: "Kho vận", tone: "var(--success)" },
  { x: 424, y: 180, label: "Webhook", tone: "var(--warning)" },
  { x: 72, y: 298, label: "Thanh toán", tone: "var(--success)" },
  { x: 408, y: 298, label: "SMS", tone: "var(--success)" },
];

const HUB = { x: 240, y: 180 };

export function TopologyIllustration() {
  return (
    <svg
      viewBox="0 0 480 360"
      className="h-auto w-full max-w-[520px]"
      role="img"
      aria-label="Sơ đồ các nhà cung cấp kết nối về trung tâm tích hợp"
    >
      <defs>
        <radialGradient id="hub-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={HUB.x} cy={HUB.y} r="120" fill="url(#hub-glow)" />
      <circle cx={HUB.x} cy={HUB.y} r="92" fill="none" stroke="var(--border)" strokeDasharray="2 6" />
      {NODES.map((node, index) => (
        <g key={node.label}>
          <path d={`M${HUB.x} ${HUB.y} L${node.x} ${node.y}`} stroke="var(--border)" strokeWidth="1.5" fill="none" />
          <path
            d={`M${HUB.x} ${HUB.y} L${node.x} ${node.y}`}
            stroke="var(--primary)"
            strokeWidth="1.5"
            strokeDasharray="4 20"
            strokeLinecap="round"
            fill="none"
            className="animate-flow"
            style={{ animationDelay: `${index * -0.45}s` }}
          />
        </g>
      ))}
      {NODES.map((node) => (
        <g key={`${node.label}-node`} transform={`translate(${node.x - 44} ${node.y - 17})`}>
          <rect width="88" height="34" rx="10" fill="var(--card)" stroke="var(--border)" />
          <circle cx="15" cy="17" r="3.5" fill={node.tone} />
          <text x="25" y="21.5" fontSize="11.5" fontWeight="500" fill="var(--foreground)" fontFamily="var(--font-sans)">
            {node.label}
          </text>
        </g>
      ))}
      <g transform={`translate(${HUB.x - 34} ${HUB.y - 34})`}>
        <rect width="68" height="68" rx="18" fill="var(--primary)" />
        <path
          d="M34 34 21 22M34 34l13-12M34 34v16"
          stroke="var(--primary-foreground)"
          strokeWidth="2.6"
          strokeLinecap="round"
          opacity="0.75"
        />
        <circle cx="34" cy="34" r="6.5" fill="var(--primary-foreground)" />
        <circle cx="21" cy="22" r="3.6" fill="var(--primary-foreground)" />
        <circle cx="47" cy="22" r="3.6" fill="var(--primary-foreground)" />
        <circle cx="34" cy="50" r="3.6" fill="var(--primary-foreground)" />
      </g>
    </svg>
  );
}
