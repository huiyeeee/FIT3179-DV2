/* ⓘ tooltips shared by all chapters. Each .tip holds a <button class="info"> and a <span class="tip-pop">.
 * Shows on hover, keyboard focus and tap (a tap pins it open); Escape or a click elsewhere closes it. */
window.initTips = function (root) {
  const tips = [...root.querySelectorAll(".tip")];
  const setTip = (t, on) => { t.querySelector(".info").setAttribute("aria-expanded", on); t.querySelector(".tip-pop").hidden = !on; };
  tips.forEach((t) => {
    const btn = t.querySelector(".info");
    let pinned = false;
    const close = () => { pinned = false; setTip(t, false); };
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (pinned) return close();
      tips.forEach((o) => o !== t && o.closeTip());
      pinned = true; setTip(t, true);
    });
    t.addEventListener("mouseenter", () => setTip(t, true));
    t.addEventListener("mouseleave", () => { if (!pinned && document.activeElement !== btn) setTip(t, false); });
    btn.addEventListener("focus", () => setTip(t, true));
    btn.addEventListener("blur", close);
    t.addEventListener("keydown", (e) => { if (e.key === "Escape") { close(); btn.focus(); } });
    t.closeTip = close;
  });
  document.addEventListener("click", () => tips.forEach((o) => o.closeTip()));
};
