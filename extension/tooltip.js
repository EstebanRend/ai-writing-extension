const tooltipState = {
  el: null,
  menuOpen: false,
  openSubmenuRow: null,
  shellHtml: null,
  shellLoad: null,
  mainButtonInnerHtml: null
};

const SUBMENU_CHEVRON = `<svg class="aiw-icon aiw-icon--chevron-right" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>`;

function getTooltipElement() {
  return tooltipState.el;
}

function queryTooltip(selector) {
  return tooltipState.el?.querySelector(selector) ?? null;
}

function loadTooltipShell() {
  if (tooltipState.shellHtml) {
    return Promise.resolve(tooltipState.shellHtml);
  }
  if (!tooltipState.shellLoad) {
    const url = chrome.runtime.getURL("tooltip-shell.html");
    tooltipState.shellLoad = fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load tooltip shell (${response.status})`);
        }
        return response.text();
      })
      .then((html) => {
        tooltipState.shellHtml = html.trim();
        return tooltipState.shellHtml;
      });
  }
  return tooltipState.shellLoad;
}

function removeTooltip() {
  tooltipState.menuOpen = false;
  closeSubmenu();
  if (tooltipState.el) {
    tooltipState.el.remove();
    tooltipState.el = null;
  }
}

function closeSubmenu() {
  if (tooltipState.openSubmenuRow) {
    tooltipState.openSubmenuRow.classList.remove("aiw-menu__row--open");
    const submenu = tooltipState.openSubmenuRow.querySelector(".aiw-submenu");
    if (submenu) {
      submenu.hidden = true;
    }
    tooltipState.openSubmenuRow = null;
  }
}

function setMenuOpen(open) {
  tooltipState.menuOpen = open;
  if (!open) {
    closeSubmenu();
  }
  if (!tooltipState.el) {
    return;
  }

  const menuButton = queryTooltip(`#${AIW_CONFIG.dom.menuButton}`);
  const menu = queryTooltip(`#${AIW_CONFIG.dom.menu}`);
  menuButton?.setAttribute("aria-expanded", open ? "true" : "false");
  if (menu) {
    menu.hidden = !open;
  }
}

function isMenuOpen() {
  return tooltipState.menuOpen;
}

function renderMainButtonLabel() {
  const button = queryTooltip(`#${AIW_CONFIG.dom.mainButton}`);
  const labelEl = queryTooltip("[data-aiw='main-label']");
  if (!button || !labelEl) {
    return;
  }
  labelEl.textContent = getActionLabel(getCurrentActionId());
}

function setLoading(loading) {
  if (!tooltipState.el) {
    return;
  }

  const button = queryTooltip(`#${AIW_CONFIG.dom.mainButton}`);
  const menuButton = queryTooltip(`#${AIW_CONFIG.dom.menuButton}`);
  if (!button) {
    return;
  }

  if (menuButton) {
    menuButton.disabled = loading;
  }

  if (loading) {
    setMenuOpen(false);
    tooltipState.el.classList.add("aiw-loading");
    button.innerHTML = '<span class="aiw-stop-indicator" aria-hidden="true"></span>';
    button.setAttribute("aria-label", "Stop");
    return;
  }

  tooltipState.el.classList.remove("aiw-loading");
  if (tooltipState.mainButtonInnerHtml) {
    button.innerHTML = tooltipState.mainButtonInnerHtml;
    renderMainButtonLabel();
  }
  button.removeAttribute("aria-label");
}

function buildLeafItemHtml(leaf) {
  return `<li role="none" class="aiw-menu__row">
    <button type="button" class="aiw-menu__item" role="menuitem" data-action-id="${leaf.id}">${leaf.label}</button>
  </li>`;
}

function buildSubmenuHtml(children) {
  return children.map((node) => (aiwIsLeaf(node) ? buildLeafItemHtml(node) : "")).join("");
}

function buildMenuNodesHtml(nodes) {
  return nodes
    .map((node) => {
      if (aiwIsLeaf(node)) {
        return buildLeafItemHtml(node);
      }
      if (!Array.isArray(node.children) || node.children.length === 0) {
        return "";
      }
      return `<li role="none" class="aiw-menu__row aiw-menu__row--parent" data-group-id="${node.id}">
        <button type="button" class="aiw-menu__item aiw-menu__item--parent" role="menuitem" aria-haspopup="true" aria-expanded="false">
          <span class="aiw-menu__item-label">${node.label}</span>
          ${SUBMENU_CHEVRON}
        </button>
        <ul class="aiw-submenu" role="menu" hidden>
          ${buildSubmenuHtml(node.children)}
        </ul>
      </li>`;
    })
    .join("");
}

function renderMenu(menu) {
  if (!menu) {
    return;
  }
  menu.innerHTML = buildMenuNodesHtml(aiwGetActionTree());
}

function positionSubmenu(row) {
  const submenu = row.querySelector(".aiw-submenu");
  if (!submenu) {
    return;
  }
  submenu.classList.remove("aiw-submenu--flip");
  const rect = submenu.getBoundingClientRect();
  if (rect.right > window.innerWidth - 8) {
    submenu.classList.add("aiw-submenu--flip");
  }
}

function openSubmenu(row) {
  if (tooltipState.openSubmenuRow === row) {
    return;
  }
  closeSubmenu();
  const submenu = row.querySelector(".aiw-submenu");
  const trigger = row.querySelector(".aiw-menu__item--parent");
  if (!submenu || !trigger) {
    return;
  }
  row.classList.add("aiw-menu__row--open");
  submenu.hidden = false;
  trigger.setAttribute("aria-expanded", "true");
  tooltipState.openSubmenuRow = row;
  positionSubmenu(row);
}

function handleMenuActionClick(actionId) {
  if (!actionId) {
    return;
  }
  setCurrentActionId(actionId);
  renderMainButtonLabel();
  setMenuOpen(false);
  void runImprove(actionId);
}

function bindMenuEvents(menu) {
  if (!menu) {
    return;
  }

  menu.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const parentTrigger = target.closest(".aiw-menu__item--parent");
    if (parentTrigger) {
      event.stopPropagation();
      const row = parentTrigger.closest(".aiw-menu__row--parent");
      if (row instanceof HTMLElement) {
        if (tooltipState.openSubmenuRow === row) {
          closeSubmenu();
        } else {
          openSubmenu(row);
        }
      }
      return;
    }

    const item = target.closest("[data-action-id]");
    if (!(item instanceof HTMLElement)) {
      return;
    }
    handleMenuActionClick(item.dataset.actionId);
  });

  for (const row of menu.querySelectorAll(".aiw-menu__row--parent")) {
    row.addEventListener("mouseenter", () => {
      if (row instanceof HTMLElement) {
        openSubmenu(row);
      }
    });
  }

  menu.addEventListener("mouseleave", (event) => {
    const related = event.relatedTarget;
    if (related instanceof Node && menu.contains(related)) {
      return;
    }
    closeSubmenu();
  });
}

/** Places the root at the selection end, shifted upward by the bar height + gap. */
function positionTooltip(root, details) {
  const anchor = getSelectionAnchorRect(details);
  root.style.left = `${window.scrollX + anchor.left}px`;
  root.style.top = `${window.scrollY + anchor.bottom}px`;
  root.style.transform = `translateY(calc(-100% - ${AIW_CONFIG.tooltipGapPx}px))`;
}

function bindTooltipEvents(root) {
  const mainButton = root.querySelector(`#${AIW_CONFIG.dom.mainButton}`);
  const menuButton = root.querySelector(`#${AIW_CONFIG.dom.menuButton}`);
  const menu = root.querySelector(`#${AIW_CONFIG.dom.menu}`);

  const preventSelectionLoss = (event) => {
    event.preventDefault();
  };

  for (const el of [mainButton, menuButton, menu]) {
    el?.addEventListener("mousedown", preventSelectionLoss);
  }

  mainButton?.addEventListener("click", () => {
    if (isImproveInFlight()) {
      stopImprove();
      return;
    }
    void runImprove(getCurrentActionId());
  });

  menuButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    setMenuOpen(!tooltipState.menuOpen);
  });

  bindMenuEvents(menu);
}

async function mountTooltipShell(root, mainLabel) {
  const shellHtml = await loadTooltipShell();
  root.innerHTML = shellHtml;

  const mainButton = root.querySelector("[data-aiw='main-button']");
  if (mainButton) {
    tooltipState.mainButtonInnerHtml = mainButton.innerHTML;
  }

  const labelEl = root.querySelector("[data-aiw='main-label']");
  if (labelEl) {
    labelEl.textContent = mainLabel;
  }

  const menu = root.querySelector(`#${AIW_CONFIG.dom.menu}`);
  renderMenu(menu);
}

async function createTooltip(details) {
  removeTooltip();
  loadActions();

  const resolvedAction = aiwResolveLeaf(getCurrentActionId());
  if (resolvedAction) {
    setCurrentActionId(resolvedAction.id);
  }

  const root = document.createElement("div");
  root.id = AIW_CONFIG.dom.root;
  positionTooltip(root, details);

  try {
    await mountTooltipShell(root, getActionLabel(getCurrentActionId()));
  } catch (error) {
    console.error("[AI Writing Assistant] tooltip shell failed to load", error);
    return;
  }

  document.body.appendChild(root);
  tooltipState.el = root;
  bindTooltipEvents(root);
}

function refreshTooltip() {
  const details = getSelectionDetails();
  if (!details) {
    clearSelectedState();
    removeTooltip();
    return;
  }

  const previous = getSelectedState();
  const unchanged =
    tooltipState.el &&
    previous?.text === details.text &&
    previous?.mode === details.mode &&
    previous?.start === details.start &&
    previous?.end === details.end;

  setSelectedState(details);

  if (unchanged) {
    positionTooltip(tooltipState.el, details);
    return;
  }

  void createTooltip(details);
}

function shouldRefreshTooltipFromEvent(event) {
  if (!tooltipState.el || !(event.target instanceof Node)) {
    return true;
  }
  return !tooltipState.el.contains(event.target);
}

function handleEscapeKey() {
  if (isImproveInFlight()) {
    stopImprove();
    return true;
  }
  if (tooltipState.openSubmenuRow) {
    closeSubmenu();
    return true;
  }
  if (isMenuOpen()) {
    setMenuOpen(false);
    return true;
  }
  clearSelectedState();
  removeTooltip();
  return true;
}

void loadTooltipShell();
