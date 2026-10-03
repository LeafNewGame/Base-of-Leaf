/* =========================================================
   計画整理ツール：モード切り替え（チャート / リスト）
   どちらのモードを開いても、それぞれの画面は自動保存されます
   ========================================================= */

(function () {
  "use strict";

  var tabChart = document.getElementById("pt-tab-chart");
  var tabList  = document.getElementById("pt-tab-list");
  var viewChart= document.getElementById("pt-view-chart");
  var viewList = document.getElementById("pt-view-list");

  // モード切り替えUIが無いページでは何もしない
  if (!tabChart || !tabList || !viewChart || !viewList) return;

  var MODE_KEY = "planner_mode_v1";

  function show(mode) {
    var isChart = (mode !== "list");
    viewChart.hidden = !isChart;
    viewList.hidden  = isChart;
    tabChart.classList.toggle("pc-on", isChart);
    tabList.classList.toggle("pc-on", !isChart);
    try { localStorage.setItem(MODE_KEY, isChart ? "chart" : "list"); } catch (e) {}
  }

  tabChart.addEventListener("click", function () { show("chart"); });
  tabList.addEventListener("click", function () { show("list"); });

  var saved = "chart";
  try { saved = localStorage.getItem(MODE_KEY) || "chart"; } catch (e) {}
  show(saved);
})();
