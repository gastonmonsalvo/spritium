/**
 * timelineMatrixTagsView.js: Renderizado e interacción de la fila de Frame Tags en la matriz del timeline.
 */

import { state } from "../core/state.js";
import { setStatus } from "../ui/status.js";
import { deleteFrameTag, startInlineTagRename, toggleSelectFrameTag } from "./timelineTagsAndCels.js";
import { i18n } from "../i18n/I18nService.js";

function attachTagResizeHandle(chip, track, tag, frameCount, side, onRefresh) {
  const handle = document.createElement("span");
  handle.className = `tm-tag-handle ${side}`;
  handle.title = i18n.t(side === "right" ? "matrix.tag_resize_right" : "matrix.tag_resize_left");
  handle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    state.activeTagId = tag.id;
    const trackRect = track.getBoundingClientRect();
    const colWidth = Math.max(12, trackRect.width / Math.max(1, frameCount));
    const startFrom = tag.from;
    const startTo = tag.to;

    const onMove = (ev) => {
      const targetIdx = Math.max(0, Math.min(frameCount - 1, Math.floor((ev.clientX - trackRect.left) / colWidth)));
      if (side === "right") tag.to = Math.max(tag.from, targetIdx);
      else tag.from = Math.min(tag.to, targetIdx);
      chip.style.gridColumn = `${tag.from + 1} / ${tag.to + 2}`;
      chip.title = `${tag.name} (${tag.from + 1}–${tag.to + 1})`;
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (tag.from !== startFrom || tag.to !== startTo) {
        setStatus({ key: "log.tag_info", params: { name: tag.name, from: tag.from + 1, to: tag.to + 1 } });
      }
      onRefresh();
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });
  chip.appendChild(handle);
}

function createTagChipElement(tag, track, frameCount, onRefresh) {
  const from = Math.max(0, Math.min(frameCount - 1, tag.from));
  const to = Math.max(from, Math.min(frameCount - 1, tag.to));
  const chip = document.createElement("div");
  chip.className = `tm-tag-chip${state.activeTagId === tag.id ? " active" : ""}`;
  chip.dataset.tagId = tag.id;
  chip.style.gridColumn = `${from + 1} / ${to + 2}`;
  chip.style.backgroundColor = tag.color || "#2563eb";
  chip.title = i18n.t("matrix.tag_chip_title", { name: tag.name, from: from + 1, to: to + 1 });
  chip.textContent = tag.name;

  attachTagResizeHandle(chip, track, tag, frameCount, "left", onRefresh);
  attachTagResizeHandle(chip, track, tag, frameCount, "right", onRefresh);

  let clickTimer = null;
  chip.addEventListener("click", () => {
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => toggleSelectFrameTag(tag.id), 220);
  });
  chip.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    clearTimeout(clickTimer);
    startInlineTagRename(chip, tag.id);
  });
  chip.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    deleteFrameTag(tag.id);
  });
  return chip;
}

/**
 * Renderiza la fila superior de Frame Tags alineada con las columnas de frames.
 * @param {HTMLElement|null} tagsRow
 * @param {number} frameCount
 * @param {number} layerColWidth
 * @param {string} frameColsTemplate
 * @param {() => void} onRefresh
 */
export function renderTimelineTagsRow(tagsRow, frameCount, layerColWidth, frameColsTemplate, onRefresh) {
  if (!tagsRow) return;
  tagsRow.innerHTML = "";
  const spacer = document.createElement("div");
  spacer.className = "tm-layer-col-spacer";
  spacer.style.width = `${layerColWidth}px`;
  spacer.innerHTML = `<button type="button" class="tool-btn" data-action="createFrameTagDialog" style="font-size: 10px; padding: 2px 6px" title="${i18n.t("matrix.add_tag_title")}">+ Tag</button>`;
  tagsRow.appendChild(spacer);

  const track = document.createElement("div");
  track.className = "tm-tags-track";
  track.style.gridTemplateColumns = frameColsTemplate;
  for (const tag of state.frameTags || []) {
    track.appendChild(createTagChipElement(tag, track, frameCount, onRefresh));
  }
  tagsRow.appendChild(track);
}
