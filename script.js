const VCP_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBAxhLhtO2PI3ip9MkZAtdMBT4GZ7FVQYA",
  authDomain: "vcp-hardware.firebaseapp.com",
  projectId: "vcp-hardware",
  storageBucket: "vcp-hardware.firebasestorage.app",
  messagingSenderId: "578071461402",
  appId: "1:578071461402:web:a13b7f34dc8316bbd59ba3",
  measurementId: "G-MR64ZFXP1W"
};




function isFirebaseConfigReady(config) {
  const values = Object.values(config || {});

  return values.length > 0 && values.every((value) => {
    return typeof value === 'string' && value.trim().length > 0 && !value.includes('YOUR_');
  });
}

function initVcpFirebase() {
  if (!window.firebase) return null;

  if (!isFirebaseConfigReady(VCP_FIREBASE_CONFIG)) {
    return null;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(VCP_FIREBASE_CONFIG);
  }

  return firebase.firestore();
}

function readStoredLeads() {
  const stored = localStorage.getItem('vcpLeads');

  if (!stored) return [];

  try {
    return JSON.parse(stored);
  } catch (_error) {
    return [];
  }
}

function writeStoredLeads(leads) {
  localStorage.setItem('vcpLeads', JSON.stringify(leads));
}

function saveLeadToFirebase(type, payload) {
  const db = initVcpFirebase();

  if (!db) {
    const existingLeads = readStoredLeads();
    const nextLead = {
      id: crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.round(Math.random() * 9999)}`,
      ...payload,
      type,
      createdAt: new Date().toISOString()
    };

    writeStoredLeads([...existingLeads, nextLead]);
    return Promise.resolve(nextLead);
  }

  const lead = {
    ...payload,
    type,
    createdAt: new Date().toISOString()
  };

  return db.collection('vcpLeads').add(lead)
    .then((docRef) => {
      const existingLeads = readStoredLeads();
      writeStoredLeads([...existingLeads, { id: docRef.id, ...lead }]);
      return { id: docRef.id, ...lead };
    })
    .catch(() => {
      const existingLeads = readStoredLeads();
      const localLead = {
        id: crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.round(Math.random() * 9999)}`,
        ...lead
      };

      writeStoredLeads([...existingLeads, localLead]);
      return localLead;
    });
}

function extractLeadPayload(type, body) {
  if (type === 'customer') {
    return {
      name: body.querySelector('#customer-name')?.value?.trim() || '',
      company: body.querySelector('#customer-company')?.value?.trim() || '',
      email: body.querySelector('#customer-email')?.value?.trim() || '',
      phone: body.querySelector('#customer-phone')?.value?.trim() || '',
      message: body.querySelector('#customer-project')?.value?.trim() || 'Customer registration request'
    };
  }

  if (type === 'callback') {
    return {
      name: body.querySelector('#callback-name')?.value?.trim() || '',
      phone: body.querySelector('#callback-phone')?.value?.trim() || '',
      email: body.querySelector('#callback-email')?.value?.trim() || '',
      message: body.querySelector('#callback-requirement')?.value?.trim() || 'Request a call back'
    };
  }

  if (type === 'supply-list') {
    return {
      name: body.querySelector('#supply-name')?.value?.trim() || '',
      email: body.querySelector('#supply-email')?.value?.trim() || '',
      phone: body.querySelector('#supply-phone')?.value?.trim() || '',
      message: body.querySelector('#supply-industry')?.value?.trim() || 'Join VCP supply list'
    };
  }

  return {
    name: '',
    email: '',
    phone: '',
    message: 'General lead request'
  };
}

function setToast(message) {
  const toast = document.createElement('div');
  toast.className = 'vcp-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add('is-visible');
  }, 10);

  window.setTimeout(() => {
    toast.remove();
  }, 3200);
}

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('site-modal');
  const modalFrame = modal?.querySelector('.modal-frame');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalClose = modal?.querySelector('.modal-close');
  let lastFocusedElement = null;

  function getFirstFocusable(container) {
    if (!container) return null;
    const focusable = container.querySelectorAll('a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])');
    return focusable.length ? focusable[0] : null;
  }

  function setBackgroundInert(state) {
    const nodes = Array.from(document.body.children).filter((n) => n.id !== 'site-modal');
    nodes.forEach((node) => {
      if ('inert' in node) {
        node.inert = state;
      } else {
        // Fallback: hide from AT when inert not supported
        if (state) node.setAttribute('aria-hidden', 'true');
        else node.removeAttribute('aria-hidden');
      }
    });
  }
  const cartCount = document.querySelector('.cart-count');
  const categoryTriggers = Array.from(document.querySelectorAll('[data-category]'));
  const productCards = Array.from(document.querySelectorAll('#products .product-card'));
  const productButtons = Array.from(document.querySelectorAll('#products .product-card .btn'));
  const searchInput = document.getElementById('search');
  const searchButton = document.querySelector('.search-wrap button');
  const productGrid = document.getElementById('products');

  const cart = [];
  let currentCategory = 'all';
  let currentSearch = '';

  const noResultsMessage = document.createElement('div');
  noResultsMessage.className = 'empty-product-message';
  noResultsMessage.id = 'product-empty-message';
  noResultsMessage.textContent = 'No tools found matching your search.';
  productGrid?.appendChild(noResultsMessage);

  function currency(value) {
    return `₹${Number(value).toLocaleString('en-IN')}`;
  }

  function refreshCartCount() {
    const totalItems = cart.reduce((sum, line) => sum + line.qty, 0);
    if (cartCount) cartCount.textContent = String(totalItems);
  }

  function refreshProductFilter(category = currentCategory, searchTerm = currentSearch) {
    const requestedCategory = String(category || 'all');
    const query = String(searchTerm || '').trim().toLowerCase();

    productCards.forEach((product) => {
      const productCategory = product.dataset.productCategory;
      const cardText = product.textContent.toLowerCase();
      const categoryMatches = requestedCategory === 'all' || productCategory === requestedCategory;
      const searchMatches = !query || cardText.includes(query);
      const show = categoryMatches && searchMatches;

      product.classList.toggle('is-hidden', !show);
    });

    const visibleProducts = productCards.filter((product) => !product.classList.contains('is-hidden'));
    if (noResultsMessage) {
      noResultsMessage.hidden = visibleProducts.length > 0;
    }
  }

  function showProductsSection() {
    if (productGrid) {
      productGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function renderCartModal() {
    if (!modalTitle || !modalBody) return;

    if (cart.length === 0) {
      modalTitle.textContent = 'Your Cart is Empty';
      modalBody.innerHTML = `<p>No products in your cart yet.</p><div class="button-row"><button class="btn btn-primary" data-modal-close="true">Shop Tools</button></div>`;
      modalBody.querySelectorAll('[data-modal-close]').forEach((button) => {
        button.addEventListener('click', closeModal);
      });
      return;
    }

    const subtotal = cart.reduce((sum, line) => sum + (line.price * line.qty), 0);
    const list = cart.map((line) => `
      <li>
        <span>${line.name}</span>
        <span>
          <div class="cart-line-controls">
            <button class="cart-change" data-cart-action="decrease" data-cart-name="${line.name}" aria-label="Remove one">−</button>
            <span class="cart-qty">${line.qty}</span>
            <button class="cart-change" data-cart-action="increase" data-cart-name="${line.name}" aria-label="Add one">+</button>
            <span class="cart-line-total">${currency(line.price * line.qty)}</span>
          </div>
        </span>
      </li>
    `).join('');

    modalTitle.textContent = 'Cart Summary';
    modalBody.innerHTML = `
      <p>Your selected VCP hardware items.</p>
      <ul class="modal-product-list cart-list">
        ${list}
      </ul>
      <div class="modal-total">Subtotal: ${currency(subtotal)}</div>
      <div class="button-row">
        <button class="btn btn-primary" data-modal-close="true">Checkout</button>
        <button class="btn btn-ghost" data-modal-close="true">Continue Shopping</button>
      </div>
    `;

    modalBody.querySelectorAll('[data-cart-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const name = button.dataset.cartName;
        const action = button.dataset.cartAction;
        const cartLine = cart.find((line) => line.name === name);
        if (!cartLine) return;

        if (action === 'increase') {
          cartLine.qty += 1;
        } else {
          cartLine.qty -= 1;
          if (cartLine.qty <= 0) {
            const idx = cart.findIndex((line) => line.name === name);
            if (idx >= 0) cart.splice(idx, 1);
          }
        }

        refreshCartCount();
        renderCartModal();
      });
    });

    modalBody.querySelectorAll('[data-modal-close]').forEach((button) => {
      button.addEventListener('click', closeModal);
    });
  }

  const modalForms = {
    products: {
      title: 'Shop Best Sellers',
      body: `<p>Our VCP specialists have prepared a tool shortlist for your project.</p>
        <div class="modal-product-list">
          <li><span>VCP Cordless Drill Pro</span><span>₹3,499</span></li>
          <li><span>Heavy Duty Safety Kit</span><span>₹1,790</span></li>
          <li><span>Mechanic Tool Set 120Pc</span><span>₹4,899</span></li>
        </div>
        <div class="button-row">
          <button class="btn btn-primary" data-modal-close="true">Choose Products</button>
          <button class="btn btn-ghost" data-modal-close="true">Request Quote</button>
        </div>`
    },
    departments: {
      title: 'Departments',
      body: `<p>Choose a hardware supply area to start sourcing tools.</p>
        <div class="modal-form-grid">
          <div class="full-span">
            <label for="department-select">Shop Category</label>
            <select id="department-select">
              <option>Hand Tools</option>
              <option>Power Tools</option>
              <option>Safety Gear</option>
              <option>Electrical</option>
              <option>Fasteners</option>
              <option>Engineering</option>
            </select>
          </div>
          <div class="full-span">
            <label for="department-message">Project Requirement</label>
            <textarea id="department-message" placeholder="Describe the tools you need..."></textarea>
          </div>
        </div>
        <div class="button-row">
          <button class="btn btn-primary" data-modal-close="true">Continue</button>
          <button class="btn btn-ghost" data-modal-close="true">Cancel</button>
        </div>`
    },
    quote: {
      title: 'Request a Quote',
      body: `<p>Tell our team what you need and we’ll prepare a supplier quote.</p>
        <div class="modal-form-grid">
          <div>
            <label for="quote-name">Name</label>
            <input type="text" id="quote-name" placeholder="Your name" />
          </div>
          <div>
            <label for="quote-phone">Phone</label>
            <input type="tel" id="quote-phone" placeholder="+91 00000 00000" />
          </div>
          <div class="full-span">
            <label for="quote-qty">Requirement</label>
            <textarea id="quote-qty" placeholder="Quantity, brand, delivery location..."></textarea>
          </div>
        </div>
        <div class="button-row">
          <button class="btn btn-primary" data-modal-close="true">Submit Request</button>
          <button class="btn btn-ghost" data-modal-close="true">Save for Later</button>
        </div>`
    },
    account: {
      title: 'My Account',
      body: `<p>Welcome back to VCP Hardware Tools.</p>
        <div class="modal-alert">You are signed in as a trade customer.</div>
        <div class="button-row">
          <button class="btn btn-primary" data-modal-close="true">Open Dashboard</button>
          <button class="btn btn-ghost" data-modal-close="true">Track Orders</button>
        </div>`
    },
    cart: {
      title: 'Cart Summary',
      body: `<p>Your selected VCP hardware items.</p>
        <ul class="modal-product-list">
          <li><span>VCP Cordless Drill Pro</span><span>₹3,499</span></li>
          <li><span>Mechanic Tool Set 120Pc</span><span>₹4,899</span></li>
        </ul>
        <div class="modal-total">Subtotal: ₹8,398</div>
        <div class="button-row">
          <button class="btn btn-primary" data-modal-close="true">Checkout</button>
          <button class="btn btn-ghost" data-modal-close="true">Continue Shopping</button>
        </div>`
    },
    brands: {
      title: 'Brand Store',
      body: `<p>Shop trusted hardware and industrial equipment brands.</p>
        <div class="modal-form-grid">
          <div class="full-span">
            <label for="brand-list">Popular Brands</label>
            <select id="brand-list">
              <option>Stanley</option>
              <option>Bosch</option>
              <option>Makita</option>
              <option>VCP</option>
            </select>
          </div>
        </div>
        <div class="button-row">
          <button class="btn btn-primary" data-modal-close="true">View Products</button>
          <button class="btn btn-ghost" data-modal-close="true">Compare Brands</button>
        </div>`
    },
    customer: {
      title: 'Become a VCP Customer',
      body: `<p>Request business onboarding for trade pricing and procurement support.</p>
        <div class="modal-form-grid">
          <div>
            <label for="customer-name">Contact Name</label>
            <input type="text" id="customer-name" placeholder="Your name" />
          </div>
          <div>
            <label for="customer-company">Company Name</label>
            <input type="text" id="customer-company" placeholder="Company name" />
          </div>
          <div>
            <label for="customer-email">Email</label>
            <input type="email" id="customer-email" placeholder="sales@company.com" />
          </div>
          <div>
            <label for="customer-phone">Phone</label>
            <input type="tel" id="customer-phone" placeholder="+91 00000 00000" />
          </div>
          <div class="full-span">
            <label for="customer-project">Trade Requirement</label>
            <textarea id="customer-project" placeholder="Tell us about your supply or project requirement..."></textarea>
          </div>
        </div>
        <div class="button-row">
          <button class="btn btn-primary" data-lead-submit="customer">Submit Request</button>
          <button class="btn btn-ghost" data-modal-close="true">Talk to Support</button>
        </div>`
    },
    callback: {
      title: 'Request a Call Back',
      body: `<p>Tell us the best time to call and we’ll get back with a VCP response.</p>
        <div class="modal-form-grid">
          <div>
            <label for="callback-name">Name</label>
            <input type="text" id="callback-name" placeholder="Your name" />
          </div>
          <div>
            <label for="callback-phone">Phone</label>
            <input type="tel" id="callback-phone" placeholder="+91 00000 00000" />
          </div>
          <div class="full-span">
            <label for="callback-email">Email</label>
            <input type="email" id="callback-email" placeholder="you@company.com" />
          </div>
          <div class="full-span">
            <label for="callback-requirement">Requirement</label>
            <textarea id="callback-requirement" placeholder="What would you like us to call about?"></textarea>
          </div>
        </div>
        <div class="button-row">
          <button class="btn btn-primary" data-lead-submit="callback">Request Callback</button>
          <button class="btn btn-ghost" data-modal-close="true">Maybe Later</button>
        </div>`
    },
    'supply-list': {
      title: 'Join the VCP Supply List',
      body: `<p>Join the VCP supply list to receive product and procurement updates.</p>
        <div class="modal-form-grid">
          <div>
            <label for="supply-name">Name</label>
            <input type="text" id="supply-name" placeholder="Your name" />
          </div>
          <div>
            <label for="supply-email">Email</label>
            <input type="email" id="supply-email" placeholder="you@example.com" />
          </div>
          <div class="full-span">
            <label for="supply-phone">Phone</label>
            <input type="tel" id="supply-phone" placeholder="+91 00000 00000" />
          </div>
          <div class="full-span">
            <label for="supply-industry">Supply Area</label>
            <textarea id="supply-industry" placeholder="Which supply category are you interested in?"></textarea>
          </div>
        </div>
        <div class="button-row">
          <button class="btn btn-primary" data-lead-submit="supply-list">Join Supply List</button>
          <button class="btn btn-ghost" data-modal-close="true">Cancel</button>
        </div>`
    },
    newsletter: {
      title: 'Subscribe to VCP Updates',
      body: `<p>Get weekly deals, supplier updates, and VCP product announcements.</p>
        <div class="modal-alert">Your subscription request is ready to submit.</div>
        <div class="button-row">
          <button class="btn btn-primary" data-lead-submit="supply-list">Join Newsletter</button>
          <button class="btn btn-ghost" data-modal-close="true">Maybe Later</button>
        </div>`
    }
  };

  function openModal(type) {
    if (!modal || !modalTitle || !modalBody) return;

    if (type === 'cart') {
      renderCartModal();
    } else {
      const config = modalForms[type] || modalForms.products;
      modalTitle.textContent = config.title;
      modalBody.innerHTML = config.body;

      modalBody.querySelectorAll('[data-modal-close]').forEach((button) => {
        button.addEventListener('click', closeModal);
      });
    }

    modalBody.querySelectorAll('[data-lead-submit]').forEach((button) => {
      button.addEventListener('click', () => {
        const leadType = button.dataset.leadSubmit;
        const leadPayload = extractLeadPayload(leadType, modalBody);

        if (!leadPayload.name && !leadPayload.company && !leadPayload.email && !leadPayload.phone) {
          setToast('Please provide at least one contact detail.');
          return;
        }

        saveLeadToFirebase(leadType, leadPayload)
          .then(() => {
            setToast('Request submitted successfully.');
            closeModal();
          })
          .catch(() => {
            setToast('Unable to submit right now.');
          });
      });
    });

    // Manage focus and inert background before showing modal
    lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setBackgroundInert(true);

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    modalFrame?.setAttribute('aria-hidden', 'false');

    // Move focus into the modal
    const first = getFirstFocusable(modalBody) || modalFrame;
    try {
      first?.focus();
    } catch (_e) {
      // ignore focus errors
    }
  }

  function closeModal() {
    if (!modal) return;

    // If focus is still inside the modal, restore it before hiding
    const active = document.activeElement;
    if (modal.contains(active)) {
      try {
        if (lastFocusedElement && lastFocusedElement.focus) lastFocusedElement.focus();
        else document.body.focus();
      } catch (_e) {
        document.body.focus();
      }
    }

    // Remove inert from background, then hide modal for accessibility
    setBackgroundInert(false);
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    modalFrame?.setAttribute('aria-hidden', 'true');
    lastFocusedElement = null;
  }

  document.querySelectorAll('[data-modal]').forEach((trigger) => {
    const modalType = trigger.dataset.modal;
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      openModal(modalType);
    });
  });

  modalClose?.addEventListener('click', closeModal);

  modal?.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });

  document.querySelectorAll('[data-modal-close]').forEach((button) => {
    button.addEventListener('click', closeModal);
  });

  categoryTriggers.forEach((trigger) => {
    const selectedCategory = trigger.dataset.category;
    if (!selectedCategory) return;

    trigger.addEventListener('click', (event) => {
      event.preventDefault();

      currentCategory = selectedCategory;
      refreshProductFilter(currentCategory, currentSearch);

      document.querySelectorAll('[data-category]').forEach((link) => {
        link.classList.toggle('active', link.dataset.category === selectedCategory);
      });

      if (selectedCategory !== 'all') {
        const departmentName = {
          'hand-tools': 'Hand Tools',
          'power-tools': 'Power Tools',
          'safety': 'Safety',
          'welding': 'Welding',
          'electrical': 'Electrical',
          'fasteners': 'Fasteners'
        }[selectedCategory] || selectedCategory;

        if (modalTitle && modalBody) {
          modalTitle.textContent = `${departmentName} Collection`;
          const visibleCount = productCards.filter((product) => product.dataset.productCategory === selectedCategory).length;
          modalBody.innerHTML = `<p>Showing ${departmentName} products.</p><div class="modal-alert">${visibleCount} product(s) available.</div><div class="button-row"><button class="btn btn-primary" data-modal-close="true">Continue</button></div>`;
          modalBody.querySelectorAll('[data-modal-close]').forEach((button) => {
            button.addEventListener('click', closeModal);
          });
        }
      } else {
        if (modal) closeModal();
      }

      showProductsSection();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      currentSearch = event.target.value.trim().toLowerCase();
      currentCategory = 'all';

      document.querySelectorAll('[data-category]').forEach((link) => {
        link.classList.toggle('active', link.dataset.category === 'all');
      });

      refreshProductFilter(currentCategory, currentSearch);
      showProductsSection();
    });

    searchButton?.addEventListener('click', () => {
      currentSearch = searchInput.value.trim().toLowerCase();
      currentCategory = 'all';

      document.querySelectorAll('[data-category]').forEach((link) => {
        link.classList.toggle('active', link.dataset.category === 'all');
      });

      refreshProductFilter(currentCategory, currentSearch);
      showProductsSection();
    });
  }

  productButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();

      const productName = button.dataset.addCart || 'VCP Product';
      const productPrice = Number(button.dataset.cartPrice || 0);

      const existingLine = cart.find((line) => line.name === productName);
      if (existingLine) {
        existingLine.qty += 1;
      } else {
        cart.push({ name: productName, price: productPrice, qty: 1 });
      }

      refreshCartCount();
      openModal('cart');
    });
  });
});
