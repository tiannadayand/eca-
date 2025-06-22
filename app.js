
import { GoogleGenAI } from "@google/genai";

// --- STATE ---
let currentPage = 'home';
let products = [];
let selectedProduct = null;
let isLoadingAiDescription = false;

const initialProducts = [
  { id: '1', name: 'Vintage Leather Jacket', description: 'Classic brown leather jacket, size M. Well-maintained and stylish. Perfect for cool evenings or adding a retro touch to your outfit.', price: 120, seller: 'ThaboM', imageUrl: 'https://picsum.photos/seed/jacket/400/300', category: 'Fashion', keywords: 'leather, vintage, jacket, brown, retro' },
  { id: '2', name: 'Handmade Ceramic Mug Set', description: 'Unique set of two handcrafted ceramic mugs with a vibrant blue glaze. Ideal for your morning coffee or as a thoughtful gift.', price: 45, seller: 'SarahL', imageUrl: 'https://picsum.photos/seed/mugset/400/300', category: 'Home Goods', keywords: 'ceramic, handmade, mug, blue, artisan, gift' },
  { id: '3', name: 'Rare Comic Books Collection', description: 'A curated collection of over 50 rare and vintage comic books spanning various iconic series. A must-have for collectors.', price: 250, seller: 'ComicFanatic', imageUrl: 'https://picsum.photos/seed/comics/400/300', category: 'Collectibles', keywords: 'comics, vintage, books, collection, rare, superhero' },
  { id: '4', name: 'Mountain Bike - Like New', description: 'Hardly used mountain bike with premium components. Ready for your next adventure on the trails. Size L, 21 speeds.', price: 350, seller: 'AdventureSeeker', imageUrl: 'https://picsum.photos/seed/bike/400/300', category: 'Sports & Outdoors', keywords: 'mountain bike, bicycle, sports, outdoor, trails' },
];

// --- GEMINI API SETUP ---
const geminiApiKey = process.env.API_KEY;
let ai;

if (geminiApiKey) {
  ai = new GoogleGenAI({ apiKey: geminiApiKey });
} else {
  console.warn(
    "Gemini API Key (process.env.API_KEY) is not set in the environment. " +
    "Gemini API calls will fail. Ensure the environment variable is configured correctly."
  );
}

async function generateProductDescriptionWithGemini(productName, keywords) {
  if (!ai) {
    throw new Error("Gemini API client is not initialized. API key might be missing.");
  }
  if (!geminiApiKey) {
    throw new Error("Gemini API key is not configured in the environment (process.env.API_KEY). Cannot generate description.");
  }

  const model = "gemini-2.5-flash-preview-04-17";
  const prompt = `Generate a compelling and concise e-commerce product description for "${productName}". 
  Highlight its key selling points based on these features/keywords: "${keywords}".
  The description should be suitable for a C2C marketplace. 
  Aim for around 50-80 words. Be engaging and informative.
  Do not use markdown formatting in your response, just plain text.`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });
    
    const text = response.text;

    if (!text) {
        throw new Error("Received an empty response from Gemini API.");
    }
    return text.trim();

  } catch (error) {
    console.error('Error calling Gemini API:', error);
    if (error instanceof Error) {
      if (error.message.toLowerCase().includes('api key') || 
          error.message.toLowerCase().includes('permission denied') ||
          error.message.toLowerCase().includes('authentication')) {
        throw new Error('Gemini API Key is invalid, missing, or expired. Please check your environment configuration (process.env.API_KEY). Original error: ' + error.message);
      }
      throw new Error(`Failed to generate description with Gemini: ${error.message}`);
    }
    throw new Error('An unknown error occurred while communicating with Gemini API.');
  }
}


// --- DOM ELEMENTS ---
const pageElements = {
  home: document.getElementById('home-page'),
  browse: document.getElementById('browse-page'),
  sell: document.getElementById('sell-page'),
  admin: document.getElementById('admin-page'),
};
const productGrid = document.getElementById('product-grid');
const noProductsMessage = document.getElementById('no-products-message');
const adminProductsTbody = document.getElementById('admin-products-tbody');
const noAdminProductsMessage = document.getElementById('no-admin-products-message');
const adminProductTableContainer = document.getElementById('admin-product-table-container');

// Modal elements
const productModal = document.getElementById('product-modal');
const modalContent = document.getElementById('modal-content');
const modalTitle = document.getElementById('modal-title');
const modalImage = document.getElementById('modal-image');
const modalDescription = document.getElementById('modal-description');
const modalPrice = document.getElementById('modal-price');
const modalSeller = document.getElementById('modal-seller');
const modalCategory = document.getElementById('modal-category');

// Form elements
const productForm = document.getElementById('product-form');
const productNameInput = document.getElementById('product-name');
const productCategoryInput = document.getElementById('product-category');
const productPriceInput = document.getElementById('product-price');
const productImageUrlInput = document.getElementById('product-imageUrl');
const productKeywordsInput = document.getElementById('product-keywords');
const productDescriptionInput = document.getElementById('product-description');
const generateDescriptionBtn = document.getElementById('generate-description-btn');
const listItemBtn = document.getElementById('list-item-btn');
const formErrorMessage = document.getElementById('form-error-message');

// Browse page filters
const searchTermInput = document.getElementById('search-term');
const categoryFilterSelect = document.getElementById('category-filter');


// --- RENDER FUNCTIONS ---
function renderCurrentPage() {
  Object.values(pageElements).forEach(el => el.classList.remove('active'));
  if (pageElements[currentPage]) {
    pageElements[currentPage].classList.add('active');
    pageElements[currentPage].setAttribute('aria-hidden', 'false');
    // Ensure focus is managed, e.g., on the heading of the new page
    const pageTitle = pageElements[currentPage].querySelector('h1, h2');
    if (pageTitle) {
        pageTitle.setAttribute('tabindex', '-1'); // Make it focusable
        pageTitle.focus();
    }
  }
  Object.entries(pageElements).forEach(([pageKey, el]) => {
    if (pageKey !== currentPage) {
        el.setAttribute('aria-hidden', 'true');
    }
  });


  // Specific rendering for pages
  if (currentPage === 'browse') renderBrowsePage();
  if (currentPage === 'admin') renderAdminPage();
  if (currentPage === 'sell') resetProductForm();
}

function createProductCardElement(product) {
  const card = document.createElement('div');
  card.className = "bg-white rounded-xl shadow-lg overflow-hidden transform hover:scale-105 transition-transform duration-300 ease-in-out cursor-pointer flex flex-col";
  card.setAttribute('role', 'group');
  card.setAttribute('aria-labelledby', `product-title-${product.id}`);
  
  const truncatedDescription = product.description.length > 60 ? product.description.substring(0, 60) + '...' : product.description;

  card.innerHTML = `
    <img src="${product.imageUrl || `https://picsum.photos/seed/${product.id}/400/300`}" alt="${product.name}" class="w-full h-56 object-cover">
    <div class="p-6 flex flex-col flex-grow">
      <h3 id="product-title-${product.id}" class="text-xl font-semibold text-slate-800 mb-2 truncate" title="${product.name}">${product.name}</h3>
      <p class="text-xs text-indigo-500 uppercase font-semibold mb-2">${product.category}</p>
      <p class="text-slate-600 text-sm mb-3 flex-grow truncate-2-lines" title="${product.description}">
        ${truncatedDescription}
      </p>
      <div class="mt-auto">
        <p class="text-2xl font-bold text-indigo-600 mb-3" aria-label="Price: R ${product.price.toFixed(2)}">R ${product.price.toFixed(2)}</p>
        <button class="view-details-btn w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-150 ease-in-out" aria-label="View details for ${product.name}">
          View Details
        </button>
      </div>
    </div>
  `;
  card.querySelector('.view-details-btn').addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent card click if button is separate
    openProductModal(product);
  });
  card.addEventListener('click', () => openProductModal(product));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      openProductModal(product);
    }
  });
  return card;
}

function renderBrowsePage() {
  productGrid.innerHTML = ''; // Clear existing products
  const searchTerm = searchTermInput.value.toLowerCase();
  const selectedCategory = categoryFilterSelect.value;

  const filteredProducts = products.filter(product => {
    const matchesSearchTerm = product.name.toLowerCase().includes(searchTerm) || 
                              product.description.toLowerCase().includes(searchTerm);
    const matchesCategory = selectedCategory ? product.category === selectedCategory : true;
    return matchesSearchTerm && matchesCategory;
  });

  if (filteredProducts.length > 0) {
    filteredProducts.forEach(product => {
      productGrid.appendChild(createProductCardElement(product));
    });
    noProductsMessage.style.display = 'none';
  } else {
    noProductsMessage.textContent = products.length === 0 ? "No products listed yet. Be the first to sell!" : "No products match your current filters. Try adjusting your search!";
    noProductsMessage.style.display = 'block';
  }
  updateCategoryFilterOptions();
}

function updateCategoryFilterOptions() {
    const currentCategoryValue = categoryFilterSelect.value;
    const uniqueCategories = ['', ...new Set(products.map(p => p.category).sort())]; // Sort categories alphabetically
    categoryFilterSelect.innerHTML = uniqueCategories.map(category => 
        `<option value="${category}">${category ? category : 'All Categories'}</option>`
    ).join('');
    categoryFilterSelect.value = currentCategoryValue; // Preserve selection
}


function renderAdminPage() {
  adminProductsTbody.innerHTML = ''; // Clear existing table rows
  if (products.length > 0) {
    products.forEach(product => {
      const row = adminProductsTbody.insertRow();
      row.className = "hover:bg-slate-50 transition-colors";
      row.innerHTML = `
        <td class="p-4"><img src="${product.imageUrl || `https://picsum.photos/seed/${product.id}/50/50`}" alt="${product.name}" class="w-12 h-12 object-cover rounded-md"/></td>
        <td class="p-4 text-sm text-slate-700 font-medium">${product.name}</td>
        <td class="p-4 text-sm text-slate-600">${product.category}</td>
        <td class="p-4 text-sm text-slate-600">R ${product.price.toFixed(2)}</td>
        <td class="p-4 text-sm text-slate-600">${product.seller}</td>
        <td class="p-4">
          <button data-id="${product.id}" class="delete-product-btn bg-red-500 hover:bg-red-600 text-white text-xs font-semibold py-1 px-3 rounded-md transition duration-150 ease-in-out" aria-label="Delete ${product.name}">
            Delete
          </button>
        </td>
      `;
    });
    noAdminProductsMessage.style.display = 'none';
    adminProductTableContainer.style.display = 'block';
  } else {
    noAdminProductsMessage.style.display = 'block';
    adminProductTableContainer.style.display = 'none';
  }
}

function renderProductModal() {
  if (selectedProduct && productModal.style.display === 'flex') {
    modalTitle.textContent = selectedProduct.name;
    modalImage.src = selectedProduct.imageUrl || `https://picsum.photos/seed/${selectedProduct.id}/400/300`; // Use product ID for more consistent placeholder
    modalImage.alt = selectedProduct.name;
    modalDescription.textContent = selectedProduct.description;
    modalPrice.textContent = `R ${selectedProduct.price.toFixed(2)}`;
    modalSeller.textContent = `Sold by: ${selectedProduct.seller}`;
    modalCategory.textContent = `Category: ${selectedProduct.category}`;
    // Focus on the modal title or close button when opened
    document.getElementById('modal-close-btn').focus();
  }
}

function updateGenerateButtonUI() {
    const btnText = generateDescriptionBtn.querySelector('span:last-child');
    if (isLoadingAiDescription) {
        generateDescriptionBtn.innerHTML = `<span class="loader loader-sm" aria-hidden="true"></span> <span role="status">Suggesting...</span>`;
        generateDescriptionBtn.disabled = true;
        generateDescriptionBtn.setAttribute('aria-busy', 'true');
    } else {
        generateDescriptionBtn.innerHTML = 'Suggest Description';
        generateDescriptionBtn.disabled = false;
        generateDescriptionBtn.removeAttribute('aria-busy');
    }
}

// --- ACTIONS & EVENT HANDLERS ---
function navigateTo(page) {
  currentPage = page;
  renderCurrentPage();
  // Update ARIA current for nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.dataset.page === page) {
      link.setAttribute('aria-current', 'page');
      link.classList.add('text-indigo-600', 'font-semibold');
      link.classList.remove('text-slate-600');
    } else {
      link.removeAttribute('aria-current');
      link.classList.remove('text-indigo-600', 'font-semibold');
      link.classList.add('text-slate-600');
    }
  });
}

let previouslyFocusedElement = null;

function openProductModal(product) {
  previouslyFocusedElement = document.activeElement; // Store focus
  selectedProduct = product;
  productModal.style.display = 'flex';
  productModal.setAttribute('aria-hidden', 'false');
  renderProductModal();
}

function closeProductModal() {
  productModal.style.display = 'none';
  productModal.setAttribute('aria-hidden', 'true');
  selectedProduct = null;
  if (previouslyFocusedElement) {
    previouslyFocusedElement.focus(); // Restore focus
    previouslyFocusedElement = null;
  }
}

function resetProductForm() {
    productForm.reset();
    productDescriptionInput.value = ''; // Ensure textarea is also cleared
    formErrorMessage.style.display = 'none';
    formErrorMessage.textContent = '';
    isLoadingAiDescription = false;
    updateGenerateButtonUI();
    listItemBtn.disabled = false;
    productNameInput.focus(); // Focus on the first field
}

function displayFormError(message) {
    formErrorMessage.textContent = message;
    formErrorMessage.style.display = 'block';
    formErrorMessage.focus(); // Focus on error message for screen readers
}

function clearFormError() {
    formErrorMessage.style.display = 'none';
    formErrorMessage.textContent = '';
}

async function handleGenerateDescription() {
    const name = productNameInput.value.trim();
    const keywords = productKeywordsInput.value.trim();

    if (!name && !keywords) { // Allow description generation even if only one is present, API can handle it
        displayFormError('Please enter product name or keywords to generate a description suggestion.');
        return;
    }
    clearFormError();
    isLoadingAiDescription = true;
    updateGenerateButtonUI();

    try {
        const description = await generateProductDescriptionWithGemini(name || "this item", keywords); // Provide default if name is empty
        productDescriptionInput.value = description;
        productDescriptionInput.focus(); // Focus on description after populating
    } catch (err) {
        console.error("Error generating description:", err);
        if (err.message.includes('API key') || err.message.includes('configured') || err.message.includes('client is not initialized')) {
            displayFormError('Description suggestion service is not configured correctly or API key is missing. Please contact support.');
        } else {
            displayFormError('Failed to suggest description. Please try again or write your own.');
        }
    } finally {
        isLoadingAiDescription = false;
        updateGenerateButtonUI();
    }
}

function handleAddProduct(event) {
  event.preventDefault();
  clearFormError();

  const name = productNameInput.value.trim();
  const category = productCategoryInput.value;
  const price = parseFloat(productPriceInput.value);
  const description = productDescriptionInput.value.trim();
  
  if (!name || !category || isNaN(price) || price <= 0 || !description) { // Added price > 0 check
      let errorFields = [];
      if (!name) errorFields.push('Name');
      if (!category) errorFields.push('Category');
      if (isNaN(price) || price <=0) errorFields.push('Price (must be a positive number)');
      if (!description) errorFields.push('Description');
      displayFormError(`Please fill in all required fields correctly: ${errorFields.join(', ')}.`);
      return;
  }
  
  const newProduct = {
    id: Date.now().toString(),
    name,
    category,
    price,
    keywords: productKeywordsInput.value.trim(),
    description,
    imageUrl: productImageUrlInput.value.trim() || `https://picsum.photos/seed/${Date.now().toString()}/400/300`,
    seller: 'CurrentUser', // Placeholder
  };
  products = [newProduct, ...products];
  resetProductForm();
  navigateTo('browse');
}

function handleDeleteProduct(productId) {
  const productToDelete = products.find(p => p.id === productId);
  if (productToDelete && window.confirm(`Are you sure you want to delete "${productToDelete.name}"? This action cannot be undone.`)) {
    products = products.filter(p => p.id !== productId);
    renderAdminPage(); 
    renderBrowsePage(); // Update browse page if products changed
    // Potentially focus back to the admin table or a general admin element
    const adminTitle = document.getElementById('admin-page-title');
    if (adminTitle) adminTitle.focus();
  }
}

// --- INITIALIZATION ---
function init() {
  // Set initial products
  products = [...initialProducts];

  // Setup navigation
  document.getElementById('logo').addEventListener('click', () => navigateTo('home'));
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => navigateTo(e.target.dataset.page));
  });
  document.getElementById('home-browse-btn').addEventListener('click', () => navigateTo('browse'));
  document.getElementById('home-sell-btn').addEventListener('click', () => navigateTo('sell'));

  // Setup modal close
  document.getElementById('modal-close-btn').addEventListener('click', closeProductModal);
  productModal.addEventListener('click', (e) => { 
    if (e.target === productModal) {
      closeProductModal();
    }
  });
  modalContent.addEventListener('click', (e) => e.stopPropagation()); 
  document.getElementById('modal-contact-seller-btn').addEventListener('click', () => {
    alert('Contact seller functionality is a placeholder and not implemented.');
  });
  // Close modal on ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && productModal.style.display === 'flex') {
      closeProductModal();
    }
  });
  
  // Setup product form
  productForm.addEventListener('submit', handleAddProduct);
  generateDescriptionBtn.addEventListener('click', handleGenerateDescription);

  // Setup browse page filters
  searchTermInput.addEventListener('input', renderBrowsePage);
  categoryFilterSelect.addEventListener('change', renderBrowsePage);
  
  // Setup admin page delete functionality (event delegation)
  adminProductsTbody.addEventListener('click', (e) => {
    const targetButton = e.target.closest('.delete-product-btn');
    if (targetButton) {
      handleDeleteProduct(targetButton.dataset.id);
    }
  });

  // Footer year
  document.getElementById('current-year').textContent = new Date().getFullYear();

  // Initial render
  navigateTo('home');
  updateCategoryFilterOptions(); 
}

// Start the app when the DOM is ready
document.addEventListener('DOMContentLoaded', init);
