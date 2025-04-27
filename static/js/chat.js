/**
 * Функционал для работы с чатами и сообщениями
 */

// Глобальные переменные для отслеживания состояния
let chatUpdateInterval;
let chatListUpdateInterval;
let activeChatlUpdateInterval;
let currentChatId = null;
let lastMessageId = null;
let lastUpdateTime = null;
let cachedChats = [];
let isFirstLoad = true;
let isUpdatingChats = false;
let isUpdatingMessages = false;
let lastUserActivity = Date.now();

// Инициализация компонента чата
function initChatComponent() {
    console.log("Инициализация компонента чата...");
    
    // Запускаем обновление списка чатов
    startChatUpdates();
    
    // Отслеживание активности пользователя
    document.addEventListener('mousemove', updateUserActivity);
    document.addEventListener('keypress', updateUserActivity);
    document.addEventListener('click', updateUserActivity);
    document.addEventListener('touchstart', updateUserActivity);
    
    // Проверка активности пользователя каждые 30 секунд
    setInterval(checkUserActivity, 30000);
    
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
    
    // Устанавливаем интервал обновления для списка чатов - более частое обновление (1 секунда)
    chatListUpdateInterval = setInterval(updateChatsList, 1000);
    
    // Обрабатываем случай, когда пользователь уходит со страницы
    window.addEventListener('beforeunload', function() {
        if (chatListUpdateInterval) clearInterval(chatListUpdateInterval);
        if (activeChatlUpdateInterval) clearInterval(activeChatlUpdateInterval);
    });
    
    // Добавляем обработчик для видимости вкладки
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
            // Страница стала видимой - немедленно обновляем данные
            updateChatsList();
            if (currentChatId) {
                updateCurrentChatMessages();
            }
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
    if (!currentChatId || isUpdatingMessages) return;
    
    isUpdatingMessages = true;
    
    try {
        // Если у нас нет lastMessageId, делаем полную загрузку
        if (!lastMessageId) {
            await loadChatMessages(currentChatId);
            isUpdatingMessages = false;
            return;
        }
        
        // Запрашиваем только новые сообщения
        const response = await fetch(`/api/chat/${currentChatId}/messages?after_id=${lastMessageId}`);
        
        // Обработка ответов с ошибками
        if (!response.ok) {
            if (response.status === 401) {
                // Сессия истекла, нужно перенаправить на страницу входа
                console.warn("Сессия истекла. Требуется повторная авторизация.");
                handleSessionExpired();
                isUpdatingMessages = false;
                return;
            }
            throw new Error(`Ошибка обновления сообщений: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.messages && data.messages.length > 0) {
            console.log(`Получено ${data.messages.length} новых сообщений`);
            const messagesContainer = document.querySelector('.messages-container');
            if (!messagesContainer) {
                console.error('Контейнер сообщений не найден');
                isUpdatingMessages = false;
                return;
            }
            
            const atBottom = isScrolledToBottom(messagesContainer);
            
            // Обновляем ID последнего сообщения из полученных новых сообщений
            const messageIds = data.messages.map(m => m.id).filter(id => typeof id === 'number');
            if (messageIds.length > 0) {
                const maxId = Math.max(...messageIds);
                if (maxId > lastMessageId) {
                    lastMessageId = maxId;
                    console.log(`Обновлен lastMessageId: ${lastMessageId}`);
                }
            }
            
            // Добавляем новые сообщения в конец
            data.messages.forEach(message => {
                if (!message.id) {
                    console.warn('Сообщение без ID:', message);
                    return;
                }
                
                // Проверяем, что сообщение еще не существует в DOM
                const existingMessage = document.querySelector(`.message[data-message-id="${message.id}"]`);
                if (!existingMessage) {
                    // Создаем элемент сообщения
                    try {
                        const messageHTML = createMessageElement(message);
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = messageHTML;
                        
                        if (tempDiv.firstChild) {
                            messagesContainer.appendChild(tempDiv.firstChild);
                            console.log(`Добавлено сообщение ID: ${message.id}`);
                        } else {
                            console.error(`Не удалось создать элемент для сообщения:`, message);
                        }
                    } catch (error) {
                        console.error(`Ошибка при создании элемента сообщения:`, error, message);
                    }
                } else {
                    // Обновляем статус прочтения для существующего сообщения
                    const readStatusElement = existingMessage.querySelector('.message-read-status');
                    if (readStatusElement && message.read_count) {
                        readStatusElement.textContent = '✓✓';
                        readStatusElement.classList.add('read');
                    }
                }
            });
            
            // Если пользователь был внизу чата, прокручиваем к новым сообщениям
            if (atBottom) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } else if (data.messages.length > 0) {
                // Показываем индикатор новых сообщений
                showNewMessagesIndicator(data.messages.length);
            }
        }
    } catch (error) {
        console.error('Ошибка при обновлении сообщений:', error);
    } finally {
        isUpdatingMessages = false;
    }
}

// Проверка, прокручен ли контейнер сообщений до конца
function isScrolledToBottom(element) {
    const threshold = 50;
    return element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
}

// Создание HTML элемента сообщения
function createMessageElement(message) {
    if (!message || !message.id) {
        console.error('Получено некорректное сообщение:', message);
        return '';
    }
    
    // Определяем, свое сообщение или нет
    const messageClass = message.is_own ? 'message-own' : 'message-other';
    
    // Форматируем время сообщения
    let messageTime;
    try {
        messageTime = formatMessageTime(new Date(message.timestamp));
    } catch (e) {
        console.error('Ошибка форматирования времени:', e);
        messageTime = 'неизвестно';
    }
    
    // Статус прочтения (только для собственных сообщений)
    const readStatus = message.is_own ? 
        `<span class="message-read-status ${message.read_count ? 'read' : ''}">
            ${message.read_count ? '✓✓' : '✓'}
        </span>` : '';
    
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
                    ${readStatus}
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
    
    // Сразу очистим поле ввода после получения текста
    const messageCopy = messageText;
    messageInput.value = '';
    
    // Создаем FormData для отправки данных и файлов
    const formData = new FormData();
    formData.append('content', messageCopy);
    
    // Добавляем файл, если он выбран
    if (hasFile) {
        formData.append('media', fileInput.files[0]);
        fileInput.value = '';
        document.querySelector('.selected-file').style.display = 'none';
    }
    
    try {
        // Создаем временное сообщение в чате для немедленной обратной связи
        const tempId = `temp-${Date.now()}`;
        const messagesContainer = document.querySelector('.messages-container');
        
        // Создаем DOM элемент для временного сообщения
        const tempMessage = document.createElement('div');
        tempMessage.className = 'message message-own sending';
        tempMessage.dataset.messageId = tempId;
        tempMessage.innerHTML = `
            <div class="message-content">
                <div class="message-text">${messageCopy}</div>
                <div class="message-info">
                    <span class="message-time">Отправка...</span>
                    <span class="message-read-status">⌛</span>
                </div>
            </div>
        `;
        
        // Добавляем временное сообщение в контейнер и прокручиваем вниз
        messagesContainer.appendChild(tempMessage);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        console.log('Отправка сообщения:', messageCopy);
        
        // Отправляем сообщение на сервер
        const response = await fetch(`/api/chat/${currentChatId}/send_message`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        console.log('Ответ сервера:', data);
        
        if (data.success) {
            // Находим временное сообщение
            const tempMsgElement = document.querySelector(`[data-message-id="${tempId}"]`);
            
            if (data.message) {
                console.log('Полученное сообщение от сервера:', data.message);
                
                if (tempMsgElement) {
                    // Обновляем существующее временное сообщение вместо удаления и создания нового
                    tempMsgElement.dataset.messageId = data.message.id;
                    tempMsgElement.classList.remove('sending');
                    
                    // Обновляем время и статус сообщения
                    const messageInfo = tempMsgElement.querySelector('.message-info');
                    if (messageInfo) {
                        const timeElement = messageInfo.querySelector('.message-time');
                        if (timeElement) {
                            timeElement.textContent = formatMessageTime(new Date(data.message.timestamp));
                        }
                        
                        const readStatusElement = messageInfo.querySelector('.message-read-status');
                        if (readStatusElement) {
                            readStatusElement.textContent = '✓';
                        }
                    }
                    
                    // Если в ответе есть какие-то медиа, обновляем контент
                    if (data.message.has_media && !tempMsgElement.querySelector('.message-media')) {
                        const messageContent = tempMsgElement.querySelector('.message-content');
                        const messageText = messageContent.querySelector('.message-text');
                        
                        // Создаем медиа элемент в зависимости от типа
                        let mediaHTML = '';
                        switch (data.message.media_type) {
                            case 'image':
                                mediaHTML = `<div class="message-media">
                                    <img src="/api/chat/media/${data.message.id}" alt="Изображение" class="media-image">
                                </div>`;
                                break;
                            case 'video':
                                mediaHTML = `<div class="message-media">
                                    <video controls class="media-video">
                                        <source src="/api/chat/media/${data.message.id}" type="video/mp4">
                                        Ваш браузер не поддерживает видео.
                                    </video>
                                </div>`;
                                break;
                            case 'audio':
                                mediaHTML = `<div class="message-media">
                                    <audio controls class="media-audio">
                                        <source src="/api/chat/media/${data.message.id}" type="audio/mpeg">
                                        Ваш браузер не поддерживает аудио.
                                    </audio>
                                </div>`;
                                break;
                            case 'file':
                                mediaHTML = `<div class="message-media">
                                    <a href="/api/chat/media/${data.message.id}" download class="media-file">
                                        📎 Скачать файл
                                    </a>
                                </div>`;
                                break;
                        }
                        
                        if (mediaHTML) {
                            // Вставляем медиа перед текстом сообщения
                            if (messageText) {
                                messageText.insertAdjacentHTML('beforebegin', mediaHTML);
                            } else {
                                messageContent.insertAdjacentHTML('afterbegin', mediaHTML);
                            }
                        }
                    }
                } else {
                    // Если по какой-то причине временное сообщение исчезло, создаем новое
                    const realMessageHTML = createMessageElement(data.message);
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = realMessageHTML;
                    
                    if (tempDiv.firstChild) {
                        messagesContainer.appendChild(tempDiv.firstChild);
                    } else {
                        console.error('Не удалось создать элемент для сообщения:', data.message);
                    }
                }
                
                // Обновляем lastMessageId
                if (data.message.id > (lastMessageId || 0)) {
                    lastMessageId = data.message.id;
                    console.log(`Обновлен lastMessageId: ${lastMessageId}`);
                }
                
                // Прокрутка к последнему сообщению
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } else {
                console.warn('Сервер не вернул данные о сообщении');
                // Если сервер не вернул данные о сообщении, но сказал что успех,
                // оставим временное сообщение, но уберем статус "отправки"
                if (tempMsgElement) {
                    tempMsgElement.classList.remove('sending');
                    const readStatusElement = tempMsgElement.querySelector('.message-read-status');
                    if (readStatusElement) {
                        readStatusElement.textContent = '✓';
                    }
                    const timeElement = tempMsgElement.querySelector('.message-time');
                    if (timeElement) {
                        timeElement.textContent = formatMessageTime(new Date());
                    }
                }
            }
            
            // Запускаем обновление списка чатов через небольшую задержку
            setTimeout(() => updateChatsList(), 300);
        } else {
            console.error('Ошибка при отправке сообщения:', data.message);
            alert('Не удалось отправить сообщение: ' + data.message);
            
            // Заменяем временное сообщение на ошибку
            const tempMsgElement = document.querySelector(`[data-message-id="${tempId}"]`);
            if (tempMsgElement) {
                tempMsgElement.classList.add('error');
                tempMsgElement.querySelector('.message-time').textContent = 'Ошибка';
                tempMsgElement.querySelector('.message-read-status').textContent = '❌';
            }
        }
    } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
        alert('Ошибка при отправке сообщения: ' + error.message);
        
        // Возвращаем текст сообщения обратно в поле ввода при ошибке
        messageInput.value = messageCopy;
    }
}

// Показать индикатор новых сообщений
function showNewMessagesIndicator(count) {
    // Проверяем, существует ли уже индикатор
    let indicator = document.querySelector('.new-messages-indicator');
    const chatInterface = document.querySelector('.chat-interface');
    
    if (!chatInterface) return;
    
    if (!indicator) {
        // Создаем индикатор
        indicator = document.createElement('div');
        indicator.className = 'new-messages-indicator';
        indicator.textContent = `${count} новых сообщений ↓`;
        
        // Добавляем обработчик клика для прокрутки
        indicator.addEventListener('click', function() {
            const messagesContainer = document.querySelector('.messages-container');
            if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                indicator.remove();
            }
        });
        
        chatInterface.appendChild(indicator);
    } else {
        // Обновляем текст индикатора
        indicator.textContent = `${count} новых сообщений ↓`;
    }
    
    // Автоматически скрываем индикатор через 5 секунд
    setTimeout(() => {
        if (indicator && indicator.parentElement) {
            indicator.remove();
        }
    }, 5000);
}

// Определение типа медиа файла
function getMediaTypeFromFile(file) {
    if (!file) return null;
    const type = file.type;
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('audio/')) return 'audio';
    return 'file';
}

// Поддержание сессии активной
function keepSessionAlive() {
    fetch('/api/ping', { 
        method: 'GET',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin'
    }).catch(error => {
        console.log('Ошибка при обновлении сессии:', error);
    });
}

// Обработка истекшей сессии
function handleSessionExpired() {
    // Останавливаем все интервалы
    if (chatListUpdateInterval) clearInterval(chatListUpdateInterval);
    if (activeChatlUpdateInterval) clearInterval(activeChatlUpdateInterval);
    
    // Показываем уведомление
    const notification = document.createElement('div');
    notification.className = 'session-expired';
    notification.innerHTML = `
        <div class="session-message">
            <h3>Сессия истекла</h3>
            <p>Требуется повторная авторизация</p>
            <button id="relogin-btn">Войти снова</button>
        </div>
    `;
    document.body.appendChild(notification);
    
    // Обработчик для кнопки
    document.getElementById('relogin-btn').addEventListener('click', () => {
        window.location.href = '/login';
    });
    
    // Автоматическое перенаправление через 5 секунд
    setTimeout(() => {
        window.location.href = '/login';
    }, 5000);
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

// Обновление активности пользователя
function updateUserActivity() {
    lastUserActivity = Date.now();
}

// Проверка активности пользователя
function checkUserActivity() {
    const now = Date.now();
    const inactivityThreshold = 5 * 60 * 1000; // 5 минут
    if (now - lastUserActivity > inactivityThreshold) {
        console.log('Пользователь неактивен');
        // Можно добавить логику для обработки неактивности
    } else {
        console.log('Пользователь активен');
    }
}

// Экспорт функций для доступа из других модулей
window.chatModule = {
    initChatComponent,
    openChat,
    closeCurrentChat,
    updateChatsList,
    getCurrentChatId,
    updateCurrentChatMessages,
    updateUserActivity,
    keepSessionAlive
};