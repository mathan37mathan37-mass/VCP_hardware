const firebaseConfig = {
  apiKey: "AIzaSyBAxhLhtO2PI3ip9MkZAtdMBT4GZ7FVQYA",
  authDomain: "vcp-hardware.firebaseapp.com",
  projectId: "vcp-hardware",
  storageBucket: "vcp-hardware.firebasestorage.app",
  messagingSenderId: "578071461402",
  appId: "1:578071461402:web:a13b7f34dc8316bbd59ba3",
  measurementId: "G-MR64ZFXP1W"
};

let db;

function isFirebaseConfigReady(config) {
  const values = Object.values(config || {});

  return values.length > 0 && values.every((value) => {
    return typeof value === 'string' && value.trim().length > 0 && !value.includes('YOUR_');
  });
}

function initFirebase() {
  if (!window.firebase || !isFirebaseConfigReady(firebaseConfig)) {
    db = null;
    return;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  db = firebase.firestore();
}

function safeGetDatabase() {
  initFirebase();
  return db;
}

function getLeadTypeLabel(type) {
  const typeMap = {
    customer: 'Become a VCP customer',
    callback: 'Request a call back',
    'supply-list': 'Join the VCP supply list'
  };

  return typeMap[type] || type || 'General enquiry';
}

function buildLeadRow(lead) {
  const emailValue = lead.email ? `<a href="mailto:${lead.email}">${lead.email}</a>` : 'No email';
  const phoneValue = lead.phone ? `<a href="tel:${lead.phone}">${lead.phone}</a>` : 'No phone';
  const originText = lead.message || lead.request || '';
  const callHref = lead.phone ? `tel:${encodeURIComponent(lead.phone)}` : '#';
  const callLabel = lead.phone ? 'Call' : 'No phone';

  return `<tr data-lead-id="${lead.id || ''}">
    <td>${lead.createdAt ? new Date(lead.createdAt).toLocaleString() : 'Just now'}</td>
    <td><span class="lead-type">${getLeadTypeLabel(lead.type)}</span></td>
    <td>${lead.name || lead.company || '—'}</td>
    <td>${emailValue}</td>
    <td>${phoneValue}</td>
    <td>${originText ? originText.replace(/</g, '&lt;') : 'No details provided'}</td>
    <td>
      <div class="action-group">
        <a href="${callHref}" class="action-button btn-reply" ${callHref === '#' ? 'aria-disabled="true" tabindex="-1"' : ''}>${callLabel}</a>
        <button type="button" class="action-button btn-delete" data-delete-lead="${lead.id || ''}">Delete</button>
      </div>
    </td>
  </tr>`;
}

function attachLeadActions() {
  document.querySelectorAll('[data-delete-lead]').forEach((button) => {
    button.addEventListener('click', () => {
      const leadId = button.dataset.deleteLead;
      if (!leadId) return;

      const confirmed = window.confirm('Delete this lead permanently?');
      if (!confirmed) return;

      deleteLead(leadId);
    });
  });
}

function deleteLead(id) {
  const db = safeGetDatabase();
  if (db) {
    db.collection('vcpLeads').doc(id).delete()
      .then(() => {
        loadLeadsFromFirebase();
      })
      .catch(() => {
        removeLocalLead(id);
        loadLeadsFromFirebase();
      });
    return;
  }

  removeLocalLead(id);
  loadLeadsFromFirebase();
}

function removeLocalLead(id) {
  const leads = getLocalLeads();
  const filtered = leads.filter((lead) => String(lead.id) !== String(id));
  localStorage.setItem('vcpLeads', JSON.stringify(filtered));
  return filtered;
}

function renderLeadData(leads) {
  const leadRows = leads.map(buildLeadRow).join('');
  const tableBody = document.getElementById('leads-table-body');

  if (!tableBody) return;

  tableBody.innerHTML = leadRows || `<tr><td colspan="7" class="empty-row">No enquiries found.</td></tr>`;
  attachLeadActions();

  const total = leads.length;
  document.getElementById('total-leads')?.replaceChildren(document.createTextNode(String(total)));

  const customerCount = leads.filter((lead) => lead.type === 'customer').length;
  const callbackCount = leads.filter((lead) => lead.type === 'callback').length;
  const supplyCount = leads.filter((lead) => lead.type === 'supply-list').length;

  document.getElementById('customer-count')?.replaceChildren(document.createTextNode(String(customerCount)));
  document.getElementById('callback-count')?.replaceChildren(document.createTextNode(String(callbackCount)));
  document.getElementById('supply-count')?.replaceChildren(document.createTextNode(String(supplyCount)));
}

function loadLeadsFromFirebase() {
  const db = safeGetDatabase();

  if (!db) {
    renderLeadData(getLocalLeads());
    return;
  }

  db.collection('vcpLeads').orderBy('createdAt', 'desc').get()
    .then((snapshot) => {
      const leads = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      renderLeadData(leads);
    })
    .catch(() => {
      renderLeadData(getLocalLeads());
    });
}

function getLocalLeads() {
  const entries = localStorage.getItem('vcpLeads');

  if (!entries) {
    return [];
  }

  try {
    return JSON.parse(entries);
  } catch (_error) {
    return [];
  }
}

function setupAdminFilters() {
  const filter = document.getElementById('lead-type-filter');
  if (!filter) return;

  filter.addEventListener('change', () => {
    const selectedType = filter.value;
    const db = safeGetDatabase();

    if (db) {
      db.collection('vcpLeads').orderBy('createdAt', 'desc').get().then((snapshot) => {
        const firebaseLeads = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const filtered = selectedType === 'all' ? firebaseLeads : firebaseLeads.filter((lead) => lead.type === selectedType);
        renderLeadData(filtered);
      }).catch(() => {
        const leads = getLocalLeads();
        const filtered = selectedType === 'all' ? leads : leads.filter((lead) => lead.type === selectedType);
        renderLeadData(filtered);
      });
    } else {
      const leads = getLocalLeads();
      const filtered = selectedType === 'all' ? leads : leads.filter((lead) => lead.type === selectedType);
      renderLeadData(filtered);
    }
  });
}

function initAdmin() {
  initFirebase();
  setupAdminFilters();

  const refreshButton = document.getElementById('refresh-leads');
  refreshButton?.addEventListener('click', () => {
    loadLeadsFromFirebase();
  });

  loadLeadsFromFirebase();
}

document.addEventListener('DOMContentLoaded', initAdmin);
