/**
 * Функционал для работы с чатами и сообщениями
 */

// Глобальные переменные для отслеживания состояния
let chatUpdateInterval;
let currentChatId = null;
let lastMessageId = null;
let lastUpdateTime = null;
let cachedChats = [];
let isFirstLoad = true;
let isUpdatingChats = false;

// Инициализация компонента чата
function initChatComponent() {
    console.log("Инициализация компонента чата...");
    
    // Запускаем обновление списка чатов
    startChatUpdates();
    
    // Обработчик для кнопки отправки сообщения
    const sendMessageBtn = document.getElementById('send-message-btn');
    if (sendMessageBtn) {
        sendMessageBtn.addEventListener('click', sendMessage);
    }
    
    // Обработчик для поля ввода сообщения (отправка по Enter)
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    // Кнопка прикрепления файла
    const attachFileBtn = document.getElementById('attach-file');
    if (attachFileBtn) {
        attachFileBtn.addEventListener('click', function() {
            document.getElementById('file-input').click();
        });
    }
    
    // Обработка выбранного файла
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', handleSelectedFile);
    }
    
    // Обработка нажатия на кнопку "назад" в чате
    const backToChatsBtn = document.getElementById('back-to-chats');
    if (backToChatsBtn) {
        backToChatsBtn.addEventListener('click', function() {
            hideChat();
            showMainContent();
        });
    }
}

// Запуск периодического обновления чатов
function startChatUpdates() {
    // Обновляем список чатов сразу при запуске
    updateChatsList();
    
    // Устанавливаем интервал обновления (1 секунда)
    chatUpdateInterval = setInterval(updateChatsList, 1000);
    
    // Обрабатываем случай, когда пользователь уходит со страницы
    window.addEventListener('beforeunload', function() {
        if (chatUpdateInterval) {
            clearInterval(chatUpdateInterval);
        }
    });
}

// Обновление списка чатов
async function updateChatsList() {
    // Предотвращаем параллельные запросы
    if (isUpdatingChats) return;
    isUpdatingChats = true;
    
    try {
        const response = await fetch('/api/chats');
        if (!response.ok) {
            throw new Error('Ошибка загрузки чатов');
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Сравниваем с предыдущим состоянием, чтобы предотвратить ненужные обновления DOM
            if (isFirstLoad || hasChatsChanged(cachedChats, data.chats)) {
                renderChatsList(data.chats);
                cachedChats = data.chats;
                isFirstLoad = false;
            }
            
            // Если открыт какой-то чат, обновляем его содержимое
            if (currentChatId) {
                updateCurrentChatMessages();
            }
        } else {
            console.error('Ошибка при загрузке чатов:', data.message);
        }
    } catch (error) {
        console.error('Ошибка при обновлении чатов:', error);
    } finally {
        isUpdatingChats = false;
    }
}

// Проверка изменений в списке чатов
function hasChatsChanged(oldChats, newChats) {
    if (oldChats.length !== newChats.length) return true;
    
    // Проверяем изменения в последнем сообщении или времени
    for (let i = 0; i < newChats.length; i++) {
        const oldChat = oldChats.find(c => c.id === newChats[i].id);
        if (!oldChat) return true;
        
        // Сравниваем последнее сообщение и время
        if (oldChat.last_message !== newChats[i].last_message ||
            oldChat.last_message_time !== newChats[i].last_message_time) {
            return true;
        }
    }
    
    return false;
}

// Отрисовка списка чатов в интерфейсе
function renderChatsList(chats) {
    const chatListContainer = document.querySelector('.chat-list');
    if (!chatListContainer) return;
    
    if (chats.length === 0) {
        chatListContainer.innerHTML = `<div class="no-chats">Нет активных чатов</div>`;
        return;
    }
    
    let chatsHTML = '';
    
    chats.forEach(chat => {
        // Форматируем время последнего сообщения
        const lastMessageTime = chat.last_message_time ? formatMessageTime(new Date(chat.last_message_time)) : '';
        
        // Определяем иконку для чата (группа или диалог)
        const chatIcon = chat.type === 'group' ? '👥' : '👤';
        
        // Определяем URL аватара
        const avatarUrl = chat.type === 'group' 
            ? `/api/chat/group_photo/${chat.group_id}` 
            : `/api/user/photo/${chat.participant_id}`;
        
        // Формируем элемент чата
        chatsHTML += `
            <div class="chat-item" data-chat-id="${chat.id}" data-chat-type="${chat.type}">
                <div class="chat-avatar">
                    <img src="${avatarUrl}" onerror="this.src='/static/images/avatar.png'" alt="${chat.name}">
                </div>
                <div class="chat-info">
                    <div class="chat-header">
                        <span class="chat-name">${chat.name}</span>
                        <span class="chat-time">${lastMessageTime}</span>
                    </div>
                    <div class="chat-message">${chat.last_message || 'Нет сообщений'}</div>
                </div>
            </div>
        `;
    });
    
    chatListContainer.innerHTML = chatsHTML;
    
    // Добавляем обработчики для кликов по чатам
    document.querySelectorAll('.chat-item').forEach(chatItem => {
        chatItem.addEventListener('click', function() {
            const chatId = this.dataset.chatId;
            const chatType = this.dataset.chatType;
            const chatName = this.querySelector('.chat-name').textContent;
            
            openChat(chatId, chatType, chatName);
        });
    });
}

// Форматирование времени сообщения
function formatMessageTime(date) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date >= today) {
        // Сегодня - показываем только время
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (date >= yesterday) {
        // Вчера
        return 'Вчера';
    } else {
        // Другие даты
        return date.toLocaleDateString();
    }
}

// Открытие чата для просмотра и отправки сообщений
function openChat(chatId, chatType, chatName) {
    // Сохраняем ID текущего чата
    currentChatId = chatId;
    
    // Сохраняем информацию о чате в localStorage
    localStorage.setItem('lastChatId', chatId);
    localStorage.setItem('lastChatType', chatType);
    localStorage.setItem('lastChatName', chatName);
    
    // Обновляем заголовок чата
    document.querySelector('.chat-header-title').textContent = chatName;
    
    // Обновляем аватар чата
    const chatAvatar = document.getElementById('chat-avatar');
    if (chatAvatar) {
        const avatarUrl = chatType === 'group' 
            ? `/api/chat/group_photo/${chatId}` 
            : `/api/user/photo/${chatId}`;
        chatAvatar.src = avatarUrl;
        chatAvatar.onerror = function() {
            this.src = '/static/images/avatar.png';
        };
    }
    
    // Скрываем экран приветствия и показываем чат
    hideWelcomeScreen();
    showChat();
    
    // Загружаем сообщения
    loadChatMessages(chatId);
    
    // Добавляем атрибуты к форме отправки сообщения
    document.getElementById('message-form').dataset.chatId = chatId;
    document.getElementById('message-form').dataset.chatType = chatType;
    
    // На мобильных устройствах скрываем сайдбар
    if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.remove('visible');
    }
    
    // Делаем интерфейс чата активным
    document.body.classList.add('chat-active');
    
    // Фокусируемся на поле ввода
    document.getElementById('message-input').focus();
}

// Получить текущий ID чата
function getCurrentChatId() {
    return currentChatId;
}

// Закрытие текущего чата
function closeCurrentChat() {
    currentChatId = null;
    lastMessageId = null;
    document.querySelector('.messages-container').innerHTML = '<div class="no-chat-selected">Выберите чат, чтобы начать общение</div>';
    document.querySelector('.chat-header-title').textContent = 'Выберите чат';
    document.getElementById('chat-avatar').src = '/static/images/avatar.png';
    showWelcomeScreen();
    document.body.classList.remove('chat-active');
}

// Показать экран приветствия
function showWelcomeScreen() {
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.style.display = 'flex';
    }
}

// Скрыть экран приветствия
function hideWelcomeScreen() {
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.style.display = 'none';
    }
}

// Показать интерфейс чата
function showChat() {
    const chatInterface = document.getElementById('chat-interface');
    if (chatInterface) {
        chatInterface.style.display = 'flex';
    }
}

// Скрыть интерфейс чата
function hideChat() {
    showWelcomeScreen();
    closeCurrentChat();
}

// Показать основное содержимое (логотип и т.д.)
function showMainContent() {
    showWelcomeScreen();
}

// Скрыть основное содержимое
function hideMainContent() {
    hideWelcomeScreen();
}

// Загрузка сообщений чата
async function loadChatMessages(chatId, offset = 0) {
    try {
        const messagesContainer = document.querySelector('.messages-container');
        
        if (offset === 0) {
            // При первой загрузке сообщений показываем индикатор загрузки
            messagesContainer.innerHTML = '<div class="loading-messages">Загрузка сообщений...</div>';
        }
        
        const response = await fetch(`/api/chat/${chatId}/messages?offset=${offset}&limit=20`);
        if (!response.ok) {
            throw new Error('Ошибка загрузки сообщений');
        }
        
        const data = await response.json();
        
        if (data.success) {
            if (offset === 0) {
                messagesContainer.innerHTML = ''; // Очищаем контейнер
            }
            
            // Проверяем, есть ли сообщения
            if (data.messages.length === 0 && offset === 0) {
                messagesContainer.innerHTML = '<div class="no-messages">Нет сообщений</div>';
                return;
            }
            
            // Запоминаем ID последнего сообщения для последующих обновлений
            if (data.messages.length > 0) {
                const latestMessage = data.messages[0];
                lastMessageId = latestMessage.id;
            }
            
            // Обрабатываем полученные сообщения
            const messagesHTML = data.messages
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)) // Сортировка по времени
                .map(message => createMessageElement(message))
                .join('');
            
            if (offset === 0) {
                messagesContainer.innerHTML = messagesHTML;
            } else {
                // При подгрузке добавляем сообщения в начало
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = messagesHTML;
                while (tempDiv.firstChild) {
                    messagesContainer.prepend(tempDiv.firstChild);
                }
            }
            
            // Прокручиваем к последнему сообщению при первой загрузке
            if (offset === 0) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
            
            // Если есть еще сообщения для загрузки, добавляем кнопку "Загрузить еще"
            if (data.has_more) {
                const loadMoreBtn = document.createElement('div');
                loadMoreBtn.className = 'load-more-btn';
                loadMoreBtn.textContent = 'Загрузить предыдущие сообщения';
                loadMoreBtn.onclick = () => loadChatMessages(chatId, offset + data.messages.length);
                messagesContainer.prepend(loadMoreBtn);
            }
        } else {
            console.error('Ошибка при загрузке сообщений:', data.message);
            messagesContainer.innerHTML = '<div class="error-message">Ошибка загрузки сообщений</div>';
        }
    } catch (error) {
        console.error('Ошибка при загрузке сообщений:', error);
        document.querySelector('.messages-container').innerHTML = 
            '<div class="error-message">Не удалось загрузить сообщения</div>';
    }
}

// Обновление сообщений текущего чата
async function updateCurrentChatMessages() {
    if (!currentChatId) return;
    
    try {
        // Если у нас нет lastMessageId, делаем полную загрузку
        if (!lastMessageId) {
            loadChatMessages(currentChatId);
            return;
        }
        
        // Запрашиваем только новые сообщения
        const response = await fetch(`/api/chat/${currentChatId}/messages?after_id=${lastMessageId}`);
        if (!response.ok) {
            throw new Error('Ошибка обновления сообщений');
        }
        
        const data = await response.json();
        
        if (data.success && data.messages.length > 0) {
            const messagesContainer = document.querySelector('.messages-container');
            const atBottom = isScrolledToBottom(messagesContainer);
            
            // Обновляем ID последнего сообщения
            lastMessageId = data.messages[0].id;
            
            // Добавляем новые сообщения в конец
            data.messages
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                .forEach(message => {
                    const messageElement = document.createElement('div');
                    messageElement.innerHTML = createMessageElement(message);
                    messagesContainer.appendChild(messageElement.firstChild);
                });
            
            // Если пользователь был внизу чата, прокручиваем к новым сообщениям
            if (atBottom) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }
    } catch (error) {
        console.error('Ошибка при обновлении сообщений:', error);
    }
}

// Проверка, прокручен ли контейнер сообщений до конца
function isScrolledToBottom(element) {
    const threshold = 50;
    return element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
}

// Создание HTML элемента сообщения
function createMessageElement(message) {
    // Определяем, свое сообщение или нет
    const messageClass = message.is_own ? 'message-own' : 'message-other';
    
    // Форматируем время сообщения
    const messageTime = formatMessageTime(new Date(message.timestamp));
    
    // Подготовка содержимого сообщения
    let messageContent = '';
    
    // Если есть медиа
    if (message.has_media) {
        switch (message.media_type) {
            case 'image':
                messageContent += `<div class="message-media">
                    <img src="/api/chat/media/${message.id}" alt="Изображение" class="media-image">
                </div>`;
                break;
            case 'video':
                messageContent += `<div class="message-media">
                    <video controls class="media-video">
                        <source src="/api/chat/media/${message.id}" type="video/mp4">
                        Ваш браузер не поддерживает видео.
                    </video>
                </div>`;
                break;
            case 'audio':
                messageContent += `<div class="message-media">
                    <audio controls class="media-audio">
                        <source src="/api/chat/media/${message.id}" type="audio/mpeg">
                        Ваш браузер не поддерживает аудио.
                    </audio>
                </div>`;
                break;
            case 'file':
                messageContent += `<div class="message-media">
                    <a href="/api/chat/media/${message.id}" download class="media-file">
                        📎 Скачать файл
                    </a>
                </div>`;
                break;
        }
    }
    
    // Добавляем текст сообщения (если есть)
    if (message.content) {
        messageContent += `<div class="message-text">${message.content}</div>`;
    }
    
    // Создаем разметку для сообщения
    return `
        <div class="message ${messageClass}" data-message-id="${message.id}">
            <div class="message-content">
                ${messageContent}
                <div class="message-info">
                    <span class="message-time">${messageTime}</span>
                    ${message.is_edited ? '<span class="message-edited">(изм.)</span>' : ''}
                </div>
            </div>
        </div>
    `;
}

// Отправка сообщения
async function sendMessage() {
    if (!currentChatId) {
        alert('Выберите чат для отправки сообщения');
        return;
    }
    
    const messageInput = document.getElementById('message-input');
    const fileInput = document.getElementById('file-input');
    
    const messageText = messageInput.value.trim();
    const hasFile = fileInput.files && fileInput.files.length > 0;
    
    if (!messageText && !hasFile) {
        // Пустое сообщение без файла не отправляем
        return;
    }
    
    // Создаем FormData для отправки данных и файлов
    const formData = new FormData();
    formData.append('content', messageText);
    
    // Добавляем файл, если он выбран
    if (hasFile) {
        formData.append('media', fileInput.files[0]);
    }
    
    try {
        // Показываем анимацию отправки (можно добавить)
        messageInput.disabled = true;
        
        const response = await fetch(`/api/chat/${currentChatId}/send_message`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Ошибка отправки сообщения: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Очищаем поля после успешной отправки
            messageInput.value = '';
            fileInput.value = '';
            document.querySelector('.selected-file').style.display = 'none';
            
            // Обновляем сообщения в чате
            updateCurrentChatMessages();
        } else {
            console.error('Ошибка при отправке сообщения:', data.message);
            alert('Не удалось отправить сообщение: ' + data.message);
        }
    } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
        alert('Ошибка при отправке сообщения: ' + error.message);
    } finally {
        messageInput.disabled = false;
        messageInput.focus();
    }
}

// Обработка выбранного файла
function handleSelectedFile() {
    const fileInput = document.getElementById('file-input');
    const selectedFileInfo = document.querySelector('.selected-file');
    
    if (fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const fileName = file.name;
        const fileSize = formatFileSize(file.size);
        
        // Показываем информацию о выбранном файле
        selectedFileInfo.innerHTML = `
            <div class="file-info">
                <span class="file-name">${fileName}</span>
                <span class="file-size">${fileSize}</span>
            </div>
            <button type="button" class="remove-file">✖</button>
        `;
        selectedFileInfo.style.display = 'flex';
        
        // Обработчик для кнопки удаления файла
        selectedFileInfo.querySelector('.remove-file').addEventListener('click', function() {
            fileInput.value = '';
            selectedFileInfo.style.display = 'none';
        });
    } else {
        selectedFileInfo.style.display = 'none';
    }
}

// Форматирование размера файла
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' Б';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' КБ';
    else return (bytes / 1048576).toFixed(2) + ' МБ';
}

// Экспорт функций для доступа из других модулей
window.chatModule = {
    initChatComponent,
    openChat,
    closeCurrentChat,
    updateChatsList,
    getCurrentChatId
};