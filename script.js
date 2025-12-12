// script.js

// Вспомогательная функция: экранирование HTML
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Генерация безопасного ID для секции
function getSectionId(category) {
    return 'sec-' + category
        .toLowerCase()
        .replace(/[^a-z0-9а-яё\s-]/g, '')
        .replace(/\s+/g, '-');
}

// Функция для получения эмодзи по категории (ПЕРВЫЙ ВАРИАНТ)
function getEmojiForCategory(category) {
    const emojiMap = {
        // Пиво
        'Пиво': '🍺',
        'Пиво (0,5 л)': '🍺',
        'Пиво (1 л)': '🍺🍺',
        'Пиво (0,5 л, Сезонное)': '🎄🍺',
        'Пиво (1 л, Сезонное)': '🎄🍺🍺',
        
        // Еда
        'Холодные закуски': '🥗',
        'Разносолы': '🥒',
        'Салаты': '🥙',
        'Закуски из кипящего котла': '🍟',
        'Горячие закуски': '🔥',
        'Супы': '🍲',
        'Мясо': '🥩',
        'Птица': '🍗',
        'Рыба': '🐟',
        'Колбасы': '🌭',
        'Гарниры': '🥔',
        'Соусы': '🥫',
        'Десерты': '🍰',
        'Хлеб и масло': '🍞',
        
        // По умолчанию
        'default': '🍽️'
    };
    
    // Ищем точное совпадение
    if (emojiMap[category]) {
        return emojiMap[category];
    }
    
    // Ищем частичное совпадение
    for (const key in emojiMap) {
        if (category.includes(key) || key.includes(category)) {
            return emojiMap[key];
        }
    }
    
    return emojiMap['default'];
}

let userOrder = {}; 
let currentTotal = 0;

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    // Telegram WebApp init
    if (window.Telegram?.WebApp) {
        Telegram.WebApp.ready();
        Telegram.WebApp.expand();
        
        // Тема
        const bgColor = Telegram.WebApp.backgroundColor || '#f5f5f7';
        const textColor = Telegram.WebApp.textColor || '#000';
        
        document.body.style.backgroundColor = bgColor;
        document.body.style.color = textColor;
        
        // Back button
        Telegram.WebApp.BackButton.onClick(() => {
            if (document.getElementById('cart-modal').style.display === 'flex') {
                closeCart();
            } else {
                Telegram.WebApp.close();
            }
        });
        Telegram.WebApp.BackButton.hide();
    }

    // Загрузка сохранённого заказа
    loadOrderFromStorage();
    updateCartSummary();

    renderCategoryNav();
    renderMenu();
});

// Навигация
function renderCategoryNav() {
    const navContainer = document.getElementById('nav-bar');
    const categories = [...new Set(MENU_DATA.map(item => item.category))];
    let navHtml = '';
    categories.forEach(cat => {
        const safeId = getSectionId(cat);
        navHtml += `<a href="#${safeId}" class="nav-item">${escapeHtml(cat)}</a>`;
    });
    navContainer.innerHTML = navHtml;
}

// Рендер меню
function renderMenu() {
    const container = document.getElementById('menu-container');
    const categorizedMenu = MENU_DATA.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
    }, {});

    let htmlContent = '';

    for (const category in categorizedMenu) {
        const safeId = getSectionId(category);
        htmlContent += `<div id="${safeId}" class="section-header">${escapeHtml(category)}</div>`;
        
        categorizedMenu[category].forEach(item => {
            const emoji = getEmojiForCategory(item.category);
            const isSelected = userOrder[item.id] && userOrder[item.id].history && userOrder[item.id].history.length > 0;
            const qty = isSelected ? userOrder[item.id].history.length : 0;
            
            htmlContent += `
<div class="menu-item ${isSelected ? 'selected' : ''}" id="card-${item.id}" onclick="addItem(${item.id})">
    <div class="item-img">
        ${emoji}
    </div>
    <div class="item-info">
        <div class="item-name">${escapeHtml(item.name)}</div>
        <div class="item-price">${item.price} ₽</div>
    </div>
    <div class="item-counter">
        <div class="minus-btn" onclick="removeItemCheck(${item.id}, event)">−</div>
        <div class="qty-badge" id="qty-${item.id}">${qty}</div>
    </div>
</div>`;
        });
    }
    container.innerHTML = htmlContent;
}

// Добавление (Клик по карточке)
function addItem(id) {
    const item = MENU_DATA.find(i => i.id === id);
    if (!item) return;

    if (!userOrder[id]) {
        userOrder[id] = { 
            name: item.name, 
            price: item.price, 
            history: [] 
        };
    }

    const now = new Date();
    const timeString = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    userOrder[id].history.push(timeString);

    updateCardVisuals(id);
    updateCartSummary();
    saveOrderToStorage();
    
    if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
    }
}

// Удаление через карточку меню
function removeItemCheck(id, event) {
    event.stopPropagation();
    
    if (!userOrder[id] || !userOrder[id].history || userOrder[id].history.length === 0) {
        return;
    }
    
    if (confirm(`Убрать одну порцию «${escapeHtml(userOrder[id]?.name || "блюда")}»?`)) {
        userOrder[id].history.pop();
        
        if (userOrder[id].history.length === 0) {
            delete userOrder[id];
        }
        
        updateCardVisuals(id);
        updateCartSummary();
        saveOrderToStorage();
    }
}

// Удаление конкретной записи из Чека
function removeSpecificHistoryItem(id, index) {
    if (userOrder[id] && userOrder[id].history && userOrder[id].history.length > index) {
        userOrder[id].history.splice(index, 1);
        
        if (userOrder[id].history.length === 0) {
            delete userOrder[id];
        }
        
        updateCardVisuals(id);
        updateCartSummary();
        saveOrderToStorage();
        openCart();
    }
}

function updateCardVisuals(id) {
    const card = document.getElementById('card-' + id);
    const qtyBadge = document.getElementById('qty-' + id);
    
    if (!userOrder[id] || !userOrder[id].history || userOrder[id].history.length === 0) {
        if (card) {
            card.classList.remove('selected');
        }
        if (qtyBadge) {
            qtyBadge.textContent = '0';
        }
    } else {
        if (card) {
            card.classList.add('selected');
        }
        if (qtyBadge) {
            qtyBadge.textContent = userOrder[id].history.length;
        }
    }
}

function updateCartSummary() {
    currentTotal = 0;
    let totalItems = 0;
    
    for (const id in userOrder) {
        const item = userOrder[id];
        if (item && item.history) {
            currentTotal += item.history.length * item.price;
            totalItems += item.history.length;
        }
    }
    
    const cartBar = document.getElementById('cart-bar');
    const cartTotal = document.getElementById('cart-total');
    
    if (totalItems > 0) {
        cartTotal.textContent = currentTotal.toLocaleString('ru-RU') + ' ₽';
        cartBar.style.display = 'flex';
    } else {
        cartBar.style.display = 'none';
        closeCart();
    }
}

// Открытие чека
function openCart() {
    if (window.Telegram?.WebApp) {
        Telegram.WebApp.BackButton.show();
    }
    
    const listContainer = document.getElementById('order-details-list');
    listContainer.innerHTML = '';
    let hasItems = false;
    
    for (const id in userOrder) {
        const item = userOrder[id];
        const qty = item?.history?.length || 0;

        if (qty > 0) {
            hasItems = true;
            let historyHtml = '';
            
            if (item.history && item.history.length > 0) {
                item.history.forEach((time, index) => {
                    historyHtml += `
<div class="history-item">
    <span>Заказ в ${escapeHtml(time)}</span>
    <button class="delete-single-btn" onclick="removeSpecificHistoryItem(${id}, ${index})">Удалить ✕</button>
</div>`;
                });
            }
            
            listContainer.innerHTML += `
<div class="order-card">
    <div class="order-header-row">
        <span class="order-name">${escapeHtml(item.name)}</span>
        <span class="order-total-price">${(item.price * qty).toLocaleString('ru-RU')} ₽</span>
    </div>
    <div>${historyHtml}</div>
</div>`;
        }
    }

    if (!hasItems) {
        listContainer.innerHTML = '<div class="empty-state">Ваша корзина пуста</div>';
    }
    
    if (hasItems) {
        document.getElementById('cart-modal').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeCart() {
    document.getElementById('cart-modal').style.display = 'none';
    document.body.style.overflow = '';
    if (window.Telegram?.WebApp) {
        Telegram.WebApp.BackButton.hide();
    }
}

// === localStorage ===
function saveOrderToStorage() {
    try {
        localStorage.setItem('kf_order', JSON.stringify(userOrder));
    } catch (e) {
        console.warn('Не удалось сохранить заказ в localStorage', e);
    }
}

function loadOrderFromStorage() {
    try {
        const saved = localStorage.getItem('kf_order');
        if (saved) {
            const parsed = JSON.parse(saved);
            for (const id in parsed) {
                const item = MENU_DATA.find(x => x.id == id);
                if (!item) {
                    delete parsed[id];
                    continue;
                }
                parsed[id].name = item.name;
                parsed[id].price = item.price;
                
                if (!parsed[id].history) {
                    parsed[id].history = [];
                }
            }
            userOrder = parsed;
        }
    } catch (e) {
        console.warn('Ошибка загрузки заказа', e);
        userOrder = {};
    }
}

// Функция для очистки корзины
function clearCart() {
    // Проверяем, есть ли что очищать
    let hasItems = false;
    for (const id in userOrder) {
        if (userOrder[id] && userOrder[id].history && userOrder[id].history.length > 0) {
            hasItems = true;
            break;
        }
    }
    
    if (!hasItems) {
        alert('Корзина уже пуста!');
        return;
    }
    
    // Подтверждение
    if (!confirm(`Вы уверены, что хотите очистить весь заказ?\nОбщая сумма: ${currentTotal.toLocaleString('ru-RU')} ₽`)) {
        return;
    }
    
    // Очищаем заказ
    userOrder = {};
    
    // Удаляем из localStorage
    localStorage.removeItem('kf_order');
    
    // Обновляем визуал всех карточек
    document.querySelectorAll('.menu-item.selected').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Обнуляем счетчики
    document.querySelectorAll('.qty-badge').forEach(badge => {
        badge.textContent = '0';
    });
    
    // Обновляем корзину
    updateCartSummary();
    
    // Закрываем модальное окно
    closeCart();
    
    // Показываем уведомление
    if (window.Telegram?.WebApp && Telegram.WebApp.showAlert) {
        Telegram.WebApp.showAlert('✅ Корзина очищена!');
    } else {
        alert('Корзина очищена!');
    }
}

function sendOrderToBot() {
    let hasItems = false;
    for (const id in userOrder) {
        if (userOrder[id] && userOrder[id].history && userOrder[id].history.length > 0) {
            hasItems = true;
            break;
        }
    }
    
    if (!hasItems) {
        alert('Ваша корзина пуста!');
        return;
    }
    
    if (window.Telegram && window.Telegram.WebApp) {
        const dataToSend = { order: userOrder, total: currentTotal };
        window.Telegram.WebApp.sendData(JSON.stringify(dataToSend));
        
        userOrder = {};
        localStorage.removeItem('kf_order');
        updateCartSummary();
        
        document.querySelectorAll('.menu-item.selected').forEach(card => {
            card.classList.remove('selected');
        });
        
        closeCart();
        
        if (Telegram.WebApp.showAlert) {
            Telegram.WebApp.showAlert('✅ Заказ отправлен! Ожидайте официанта.');
        }
    } else {
        alert('Заказ на сумму ' + currentTotal.toLocaleString('ru-RU') + ' ₽ сформирован!');
        closeCart();
    }
}

// Закрытие модалки при клике вне контента
document.addEventListener('click', (e) => {
    const modal = document.getElementById('cart-modal');
    if (modal && modal.style.display === 'flex' && e.target === modal) {
        closeCart();
    }
});
