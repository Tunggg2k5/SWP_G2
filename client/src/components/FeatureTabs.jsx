export default function FeatureTabs({ items, active, onChange }) {
  return (
    <div className="feature-tabs" role="tablist" aria-label="Chức năng">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;

        return (
          <button
            key={item.id}
            type="button"
            className={`feature-tab ${isActive ? "active" : ""}`}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
          >
            <Icon size={17} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
