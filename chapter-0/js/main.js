/* Chapter 0 · entry point */
(async function (Ch0) {
  await Ch0.load();
  Ch0.controls.init();
  await Ch0.waffle.init();
  await Ch0.map.init();
  await Ch0.groups.init();

  // Re-draw at the new size when the window is resized
  let t;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(() => { Ch0.waffle.rebuild(); Ch0.map.rebuild(); Ch0.groups.rebuild(); }, 200);
  });
})(window.Ch0);
