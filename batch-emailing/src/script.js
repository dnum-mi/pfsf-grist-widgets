import './widget-info.js';

grist.ready({
  columns: [
    {
      name: 'emails',
      title: 'Email Column',
      type: 'Text',
      description: 'Column containing email addresses',
      optional: false
    },
    {
      name: 'content',
      title: 'Content Column',
      type: 'Text',
      description:
        'Column containing default email content. Format: [Subject] Content or just Content. Subject in brackets will be auto-extracted if at the beginning. Content from the first row will be used as template.',
      optional: true
    }
  ],
  requiredAccess: 'read table'
});

// Language translations
const translations = {
  en: {
    title: 'Batch Email Sender',
    subtitle: 'Configure and send batch emails to multiple recipients',
    recipientsLabel: 'Recipients',
    recipientsWarning:
      "💡 Filters must be applied on this widget's view to affect the recipient list. Please verify that the recipient count matches your expected results.",
    recipientsSelected: 'recipients selected',
    removedRecipientsTitle: 'Removed Recipients',
    subjectLabel: 'Email Subject',
    subjectPlaceholder: 'Enter email subject',
    contentLabel: 'Email Content',
    contentPlaceholder: 'Write your email content here...',
    emailPlaceholder: 'Enter email address',
    addRecipientBtn: 'Add Recipient',
    composeBtn: 'Compose Email',
    mapEmailError: 'Please map the email column first',
    noRecipientsError: 'No recipient emails found',
    noSubjectError: 'Please enter an email subject',
    noContentError: 'Please enter email content or configure a content column',
    invalidEmailError: 'Please enter a valid email address',
    emailExistsError: 'This email is already in the recipients list',
    emailOpened: 'Email composer opened in your default email client',
    configError: 'Please map the email column in widget configuration',
    removedFrom: 'Removed {email} from recipients',
    restoredTo: 'Restored {email} to recipients',
    addedTo: 'Added {email} to recipients',
    manualBadge: 'Manual',
    removeTitle: 'Remove',
    restoreTitle: 'Restore',
    langName: 'English',
    langCode: 'EN'
  },
  fr: {
    title: "Envoi d'emails en lot",
    subtitle: 'Configurez et envoyez des emails à plusieurs destinataires',
    recipientsLabel: 'Destinataires',
    recipientsWarning:
      '💡 Les filtres doivent être appliqués sur la vue de ce widget pour affecter la liste des destinataires. Veuillez vérifier que le nombre de destinataires correspond à vos résultats attendus.',
    recipientsSelected: 'destinataires sélectionnés',
    removedRecipientsTitle: 'Destinataires supprimés',
    subjectLabel: "Objet de l'email",
    subjectPlaceholder: "Saisissez l'objet de l'email",
    contentLabel: "Contenu de l'email",
    contentPlaceholder: 'Rédigez le contenu de votre email ici...',
    emailPlaceholder: 'Saisissez une adresse email',
    addRecipientBtn: 'Ajouter destinataire',
    composeBtn: "Composer l'email",
    mapEmailError: "Veuillez d'abord mapper la colonne email",
    noRecipientsError: 'Aucune adresse email de destinataire trouvée',
    noSubjectError: "Veuillez saisir un objet d'email",
    noContentError: "Veuillez saisir le contenu de l'email ou configurer une colonne de contenu",
    invalidEmailError: 'Veuillez saisir une adresse email valide',
    emailExistsError: 'Cette adresse email est déjà dans la liste des destinataires',
    emailOpened: "Compositeur d'email ouvert dans votre client email par défaut",
    configError: 'Veuillez mapper la colonne email dans la configuration du widget',
    removedFrom: '{email} supprimé des destinataires',
    restoredTo: '{email} restauré dans les destinataires',
    addedTo: '{email} ajouté aux destinataires',
    manualBadge: 'Manuel',
    removeTitle: 'Supprimer',
    restoreTitle: 'Restaurer',
    langName: 'Français',
    langCode: 'FR'
  }
};

const languageFlags = {
  en: '🇬🇧',
  fr: '🇫🇷'
};

let currentLang = 'fr';
let isDropdownOpen = false;

// Translation helper
function t(key, replacements = {}) {
  let text = translations[currentLang]?.[key] || translations.en?.[key] || key;
  Object.keys(replacements).forEach((placeholder) => {
    text = text.replace(`{${placeholder}}`, replacements[placeholder]);
  });
  return text;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function updateLanguage() {
  // Update header
  const titleEl = document.querySelector('.widget-header h2');
  const subtitleEl = document.querySelector('.widget-header p');
  if (titleEl) titleEl.textContent = t('title');
  if (subtitleEl) subtitleEl.textContent = t('subtitle');

  // Update labels and inputs
  const recipientsLabel = document.querySelector('label[for="recipientsList"]');
  const warningText = document.querySelector('.warning-text i');
  if (recipientsLabel) recipientsLabel.textContent = t('recipientsLabel');
  if (warningText) warningText.textContent = t('recipientsWarning');

  const subjectLabel = document.querySelector('label[for="subject"]');
  if (subjectLabel) subjectLabel.textContent = t('subjectLabel');
  if (subjectInput) subjectInput.placeholder = t('subjectPlaceholder');

  const contentLabel = document.querySelector('label[for="emailContent"]');
  if (contentLabel) contentLabel.textContent = t('contentLabel');
  if (emailContent) emailContent.placeholder = t('contentPlaceholder');

  if (newEmailInput) newEmailInput.placeholder = t('emailPlaceholder');
  if (addEmailBtn) addEmailBtn.textContent = t('addRecipientBtn');
  if (sendEmailBtn) sendEmailBtn.textContent = t('composeBtn');

  // Update lists and language selector
  updateRecipientsDisplay();
  updateRemovedEmailsDisplay();
  updateLanguageSwitcher();
}

function updateLanguageSwitcher() {
  const currentLangElement = document.querySelector('.current-lang');
  if (currentLangElement) {
    currentLangElement.innerHTML = `
            <span>${languageFlags[currentLang]}</span>
            <span class="lang-text">${t('langCode')}</span>
        `;
  }

  const dropdown = document.querySelector('.lang-dropdown');
  if (dropdown) {
    dropdown.innerHTML = '';
    Object.keys(translations).forEach((lang) => {
      if (lang !== currentLang) {
        const option = document.createElement('button');
        option.className = 'lang-option';
        option.innerHTML = `
                    <span>${languageFlags[lang]}</span>
                    <span>${translations[lang].langName}</span>
                `;
        option.addEventListener('click', () => {
          switchLanguage(lang);
          toggleDropdown(false);
        });
        dropdown.appendChild(option);
      }
    });
  }
}

function toggleDropdown(force = null) {
  const dropdown = document.querySelector('.lang-dropdown');
  if (dropdown) {
    isDropdownOpen = force !== null ? force : !isDropdownOpen;
    dropdown.classList.toggle('open', isDropdownOpen);
  }
}

function switchLanguage(lang) {
  currentLang = lang;
  updateLanguage();
  localStorage.setItem('batchEmailLang', lang);
}

function loadLanguagePreference() {
  const saved = localStorage.getItem('batchEmailLang');
  if (saved && translations[saved]) {
    currentLang = saved;
  }
}

// State
let emailList = [];
const removedEmails = new Set();
const manuallyAddedEmails = new Set();
let mappedColumns = null;
let allRecords = [];
let _currentMappings = {};

// DOM Elements
let recipientsList,
  recipientsCount,
  removedEmailsList,
  removedListSection,
  subjectInput,
  emailContent,
  newEmailInput,
  addEmailBtn,
  sendEmailBtn,
  statusMessage;

loadLanguagePreference();

// Handle record updates from Grist
grist.onRecords(function (records, mappings) {
  allRecords = records || [];
  _currentMappings = mappings || {};
  mappedColumns = allRecords.length > 0 ? grist.mapColumnNames(allRecords[0]) : null;

  if (mappedColumns) {
    const tableEmails = [
      ...new Set(
        allRecords
          .map((record) => grist.mapColumnNames(record).emails)
          .filter((email) => email && email.trim() !== '')
          .flatMap((email) =>
            email
              .split(',')
              .map((e) => e.trim())
              .filter(Boolean)
          )
      )
    ];

    // If a previously manual email is now in table data, remove from manual set
    tableEmails.forEach((email) => manuallyAddedEmails.delete(email));

    // Combine table emails and manually added emails
    emailList = [...new Set([...tableEmails, ...manuallyAddedEmails])];

    updateRecipientsDisplay();
    updateRemovedEmailsDisplay();
  } else {
    showError(t('configError'));
  }
});

// Parse content to extract subject and content
function _parseContentAndSubject(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') {
    return { subject: null, content: rawContent || '' };
  }

  const trimmedContent = rawContent.trim();
  const subjectMatch = trimmedContent.match(/^\[([^\]]+)\]\s*([\s\S]*)$/);

  if (subjectMatch) {
    return {
      subject: subjectMatch[1].trim(),
      content: subjectMatch[2].trim()
    };
  }

  return { subject: null, content: trimmedContent };
}

// Get email content from textarea
function getEmailContent() {
  return emailContent ? emailContent.value.trim() : '';
}

// Create recipient DOM element (handles both normal, manual, and removed recipients)
function createRecipientElement(email, { isRemoved = false, isManual = false } = {}) {
  const div = document.createElement('div');
  div.className = `recipient${isRemoved ? ' removed' : ''}`;

  const badgeHtml = isManual ? `<span class="tag">${t('manualBadge')}</span>` : '';

  div.innerHTML = `
        <div class="recipient-info">
            <span class="recipient-email">${escapeHtml(email)}</span>
            ${badgeHtml}
        </div>
        <div class="actions">
            ${
              isRemoved
                ? `<button class="btn-icon btn-success" data-action="restore" title="${t('restoreTitle')}">↩</button>`
                : `<button class="btn-icon btn-danger" data-action="remove" title="${t('removeTitle')}">×</button>`
            }
        </div>
    `;

  const actionBtn = div.querySelector('[data-action]');
  if (actionBtn) {
    actionBtn.addEventListener('click', () => {
      if (isRemoved) {
        restoreEmail(email);
      } else {
        removeEmail(email);
      }
    });
  }

  return div;
}

// Update the combined recipients display
function updateRecipientsDisplay() {
  if (!recipientsList || !recipientsCount) return;

  recipientsList.innerHTML = '';

  const activeEmails = emailList.filter((email) => !removedEmails.has(email));
  activeEmails.forEach((email) => {
    const isManual = manuallyAddedEmails.has(email);
    recipientsList.appendChild(createRecipientElement(email, { isManual, isRemoved: false }));
  });

  recipientsCount.innerHTML = `<b>${activeEmails.length}</b> ${t('recipientsSelected')}`;
}

// Update removed emails display
function updateRemovedEmailsDisplay() {
  if (!removedEmailsList || !removedListSection) return;

  removedEmailsList.innerHTML = '';

  if (removedEmails.size > 0) {
    removedListSection.style.display = 'block';
    const titleEl = removedListSection.querySelector('h3');
    if (titleEl) {
      titleEl.textContent = t('removedRecipientsTitle');
    }
    [...removedEmails].forEach((email) => {
      removedEmailsList.appendChild(
        createRecipientElement(email, { isRemoved: true, isManual: false })
      );
    });
  } else {
    removedListSection.style.display = 'none';
  }
}

// Remove email from active list
function removeEmail(email) {
  if (manuallyAddedEmails.has(email)) {
    manuallyAddedEmails.delete(email);
    emailList = emailList.filter((e) => e !== email);
    updateRecipientsDisplay();
    showSuccess(t('removedFrom', { email }));
  } else {
    removedEmails.add(email);
    updateRecipientsDisplay();
    updateRemovedEmailsDisplay();
    showSuccess(t('removedFrom', { email }));
  }
}

// Restore email to active list
function restoreEmail(email) {
  removedEmails.delete(email);
  updateRecipientsDisplay();
  updateRemovedEmailsDisplay();
  showSuccess(t('restoredTo', { email }));
}

// Add new email manually
function addNewEmail(email) {
  const trimmed = (email || '').trim();
  if (!isValidEmail(trimmed)) {
    showError(t('invalidEmailError'));
    return;
  }

  if (emailList.includes(trimmed)) {
    if (removedEmails.has(trimmed)) {
      restoreEmail(trimmed);
      if (newEmailInput) newEmailInput.value = '';
      return;
    }
    showError(t('emailExistsError'));
    return;
  }

  manuallyAddedEmails.add(trimmed);
  emailList.push(trimmed);
  updateRecipientsDisplay();
  if (newEmailInput) newEmailInput.value = '';
  showSuccess(t('addedTo', { email: trimmed }));
}

// Show success message
function showSuccess(message) {
  if (!statusMessage) return;
  statusMessage.className = 'status-message success';
  statusMessage.textContent = message;

  setTimeout(() => {
    statusMessage.className = 'status-message';
    statusMessage.textContent = '';
  }, 3000);
}

// Show error message
function showError(message) {
  if (!statusMessage) return;
  statusMessage.className = 'status-message error';
  statusMessage.textContent = message;
}

// Validate email address
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
  // Initialize DOM elements
  recipientsList = document.getElementById('recipientsList');
  recipientsCount = document.getElementById('recipientsCount');
  removedEmailsList = document.getElementById('removedEmails');
  removedListSection = document.getElementById('removedList');
  subjectInput = document.getElementById('subject');
  emailContent = document.getElementById('emailContent');
  newEmailInput = document.getElementById('newEmail');
  addEmailBtn = document.getElementById('addEmail');
  sendEmailBtn = document.getElementById('sendEmail');
  statusMessage = document.getElementById('statusMessage');

  // Add manual email event listeners
  if (addEmailBtn) {
    addEmailBtn.addEventListener('click', () => {
      const email = newEmailInput ? newEmailInput.value : '';
      addNewEmail(email);
    });
  }

  if (newEmailInput) {
    newEmailInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addNewEmail(newEmailInput.value);
      }
    });
  }

  // Send email button listener
  if (sendEmailBtn) {
    sendEmailBtn.addEventListener('click', function () {
      if (!mappedColumns) {
        showError(t('mapEmailError'));
        return;
      }

      const activeEmails = emailList.filter((email) => !removedEmails.has(email));
      if (activeEmails.length === 0) {
        showError(t('noRecipientsError'));
        return;
      }

      const subject = subjectInput ? subjectInput.value.trim() : '';
      if (!subject) {
        showError(t('noSubjectError'));
        return;
      }

      const content = getEmailContent();
      if (!content) {
        showError(t('noContentError'));
        return;
      }

      const mailtoUrl = `mailto:${activeEmails.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(content)}`;

      if (window.parent && window.parent !== window) {
        window.parent.open(mailtoUrl, '_blank');
      } else {
        window.open(mailtoUrl, '_blank');
      }

      showSuccess(t('emailOpened'));
    });
  }

  // Initialize language
  updateLanguage();

  // Language switcher functionality
  const currentLangElement = document.querySelector('.current-lang');
  if (currentLangElement) {
    currentLangElement.addEventListener('click', () => {
      toggleDropdown();
    });
  }

  // Close dropdown when clicking outside
  document.addEventListener('click', function (e) {
    const switcher = document.querySelector('.language-switcher');
    if (switcher && !switcher.contains(e.target)) {
      toggleDropdown(false);
    }
  });
});
