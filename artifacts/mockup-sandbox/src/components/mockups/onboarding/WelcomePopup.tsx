import { useState } from "react";

const PRIMARY = "#1E3A5F";

const TRAVEL_STYLES = [
  { emoji: "🏖", label: "Beach Lover" },
  { emoji: "🏔", label: "Mountain Explorer" },
  { emoji: "🌆", label: "City Hopper" },
  { emoji: "🍜", label: "Food Hunter" },
  { emoji: "🎒", label: "Backpacker" },
  { emoji: "💼", label: "Business Traveler" },
  { emoji: "🏕", label: "Adventure Seeker" },
  { emoji: "✈️", label: "Anywhere, I'm In!" },
];

export function WelcomePopup() {
  const [name, setName] = useState("");
  const [travelStyle, setTravelStyle] = useState("");

  const canSave = name.trim().length >= 2 && travelStyle.length > 0;

  return (
    <div className="min-h-screen bg-black/60 flex flex-col justify-end font-sans">
      {/* Blurred app behind — groups screen peek */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ background: "linear-gradient(180deg, #1E3A5F 0%, #2d5a9b 100%)" }}
      >
        <div className="p-5 pt-12 opacity-30">
          <div className="text-white text-xl font-bold mb-4">My Groups</div>
          {["Goa Trip 🌊", "Mumbai Friends", "Office Lunch"].map((g) => (
            <div key={g} className="bg-white/10 rounded-2xl p-4 mb-3">
              <div className="text-white font-semibold text-sm">{g}</div>
              <div className="text-white/60 text-xs mt-1">3 members · ₹0 owed</div>
            </div>
          ))}
        </div>
        <div className="absolute inset-0 bg-black/50" />
      </div>

      {/* Modal sheet */}
      <div
        className="relative z-10 bg-white rounded-t-[28px] px-7 pt-7 pb-10 shadow-2xl"
        style={{ maxHeight: "88vh", overflowY: "auto" }}
      >
        {/* Handle bar */}
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />

        <h2 className="text-[22px] font-bold text-gray-900 mb-1">
          Welcome to Qontri 👋
        </h2>
        <p className="text-sm text-gray-500 mb-5 leading-snug">
          Tell us a bit about yourself so your group members can recognise you.
        </p>

        {/* Name input */}
        <label className="block text-[13px] font-medium text-gray-700 mb-2">
          Your name *
        </label>
        <input
          type="text"
          placeholder="e.g. Adarsh"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-base text-gray-900 placeholder-gray-400 outline-none focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 mb-5 transition"
        />

        {/* Travel style */}
        <label className="block text-[13px] font-medium text-gray-700 mb-2">
          Your travel style *
        </label>
        <div className="flex flex-wrap gap-2 mb-5">
          {TRAVEL_STYLES.map((s) => {
            const selected = travelStyle === s.label;
            return (
              <button
                key={s.label}
                onClick={() => setTravelStyle(s.label)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border-[1.5px] text-[13px] font-medium transition"
                style={{
                  borderColor: selected ? PRIMARY : "#E5E7EB",
                  backgroundColor: selected ? "#EFF6FF" : "#F9FAFB",
                  color: selected ? PRIMARY : "#374151",
                }}
              >
                <span className="text-base">{s.emoji}</span>
                {s.label}
              </button>
            );
          })}
        </div>

        {/* CTA */}
        <button
          disabled={!canSave}
          className="w-full py-4 rounded-[14px] text-base font-semibold text-white transition"
          style={{
            backgroundColor: canSave ? PRIMARY : "#9CA3AF",
            boxShadow: canSave ? `0 4px 16px ${PRIMARY}55` : "none",
          }}
        >
          Get Started →
        </button>
      </div>
    </div>
  );
}
