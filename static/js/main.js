/**
 * Основной JS файл для функциональности главной страницы
 */

document.addEventListener('DOMContentLoaded', function() {
    // Переменные для элементов интерфейса
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    
    // Проверяем сохраненную тему
    if(localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
        themeIcon.src = '/static/images/moon.png';
    } else {
        document.body.classList.add('light-theme');
        document.body.classList.remove('dark-theme');
        themeIcon.src = '/static/images/sun.png';
    }
    
    // Переключение темы
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        document.body.classList.toggle('light-theme');
        
        if(document.body.classList.contains('dark-theme')) {
            themeIcon.src = '/static/images/moon.png';
            localStorage.setItem('theme', 'dark');
        } else {
            themeIcon.src = '/static/images/sun.png';
            localStorage.setItem('theme', 'light');
        }
    });

    // Функционал мобильного меню
    if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar');
        sidebar.addEventListener('click', function(e) {
            // Предотвращаем схлопывание при нажатии на элементы внутри
            if (e.target === this || e.target.closest('.user-info')) {
                this.classList.toggle('expanded');
            }
        });

        // Создаем кнопку для показа/скрытия сайдбара
        const toggleBtn = document.createElement('div');
        toggleBtn.className = 'sidebar-toggle';
        toggleBtn.innerHTML = '☰';
        document.body.appendChild(toggleBtn);
        
        toggleBtn.addEventListener('click', function() {
            document.querySelector('.sidebar').classList.toggle('visible');
        });
        
        // Показываем сайдбар по умолчанию, если нет активного чата
        if (!window.chatModule || !window.chatModule.getCurrentChatId()) {
            document.querySelector('.sidebar').classList.add('visible');
        }
    }

    // Кнопка нового чата
    const actionButton = document.querySelector('.action-button');
    if (actionButton) {
        actionButton.addEventListener('click', function() {
            // Открываем модальное окно для выбора пользователя
            const newChatMainBtn = document.getElementById('new-chat-main-btn');
            if (newChatMainBtn) {
                newChatMainBtn.click();
            }
        });
    }

    // Улучшенная функция для обновления URL изображения профиля с новой меткой времени
    function updateProfileImage() {
        const profileImg = document.getElementById('userProfileImage');
        if (profileImg) {
            const timestamp = new Date().getTime();
            const newSrc = `/api/user/photo?t=${timestamp}`;
            
            // Создаем новый объект Image для предварительной загрузки
            const preloadImg = new Image();
            preloadImg.onload = function() {
                profileImg.src = newSrc;
            };
            preloadImg.onerror = function() {
                profileImg.src = '/static/images/avatar.png';
            };
            preloadImg.src = newSrc;
        }
    }
    
    // Обновляем изображение при загрузке страницы
    updateProfileImage();
    
    // Также обновляем при нажатии на кнопку обновления
    const refreshIcon = document.querySelector('.refresh-icon');
    if (refreshIcon) {
        refreshIcon.addEventListener('click', function() {
            updateProfileImage();
            // Также обновляем список чатов
            if (window.chatModule) {
                window.chatModule.updateChatsList();
            }
        });
    }

    // Инициализация функционала поиска пользователей для нового чата
    const userSearchInput = document.getElementById('user-search-input');
    const searchResults = document.getElementById('search-results');
    const searchLoading = document.getElementById('search-loading');

    if (typeof initUserSearch === 'function' && userSearchInput && searchResults) {
        initUserSearch({
            searchInput: userSearchInput,
            resultsContainer: searchResults,
            loadingIndicator: searchLoading,
            onUserSelected: async function(userData) {
                try {
                    // Создаем чат с выбранным пользователем
                    const response = await fetch('/api/chat/create_dialog', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ user_id: userData.id })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        // Закрываем модальное окно
                        const modalOverlay = document.getElementById('new-chat-modal');
                        if (modalOverlay) {
                            modalOverlay.classList.remove('active');
                        }
                        
                        // Обновляем список чатов
                        if (window.chatModule) {
                            await window.chatModule.updateChatsList();
                            
                            // Открываем созданный чат
                            window.chatModule.openChat(
                                data.chat_id, 
                                'dialog',
                                userData.nickname
                            );
                        } else {
                            // Если модуль чата не инициализирован, просто перезагружаем страницу
                            location.reload();
                        }
                    } else {
                        alert(`Ошибка: ${data.message}`);
                    }
                } catch (error) {
                    console.error('Error creating chat:', error);
                    alert('Произошла ошибка при создании чата');
                }
            }
        });
    }
    
    // Инициализация компонента чата
    if (window.chatModule && typeof window.chatModule.initChatComponent === 'function') {
        window.chatModule.initChatComponent();
        
        // Проверяем был ли выбран чат ранее (например, сохраненный в localStorage)
        const lastChatId = localStorage.getItem('lastChatId');
        const lastChatType = localStorage.getItem('lastChatType');
        const lastChatName = localStorage.getItem('lastChatName');
        
        if (lastChatId && lastChatType && lastChatName) {
            setTimeout(() => {
                window.chatModule.openChat(lastChatId, lastChatType, lastChatName);
            }, 1000);
        }
    }

    // Обработчик загрузки фото контакта
    const contactPhotoInput = document.getElementById('contact-photo-input');
    const contactPreviewImage = document.getElementById('contact-preview-image');
    const contactPhotoOverlay = document.querySelector('.contact-photo-container .photo-overlay');

    if (contactPhotoInput && contactPreviewImage && contactPhotoOverlay) {
        contactPhotoOverlay.addEventListener('click', () => {
            contactPhotoInput.click();
        });

        contactPhotoInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    contactPreviewImage.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Проверка открытия модального окна
    const newContactBtn = document.getElementById('new-contact-btn');
    const newContactModal = document.getElementById('new-contact-modal');
    const contactSaveBtn = document.getElementById('contact-save-btn');
    const contactCloseBtn = document.getElementById('contact-modal-close-btn');
    const contactList = document.querySelector('.chat-list'); // Assuming contact list is in the same container as chats

    if (newContactBtn && newContactModal) {
        // Open modal
        newContactBtn.addEventListener('click', () => {
            newContactModal.classList.add('active');
        });
    }

    if (contactCloseBtn && newContactModal) {
        // Close modal on cancel
        contactCloseBtn.addEventListener('click', () => {
            newContactModal.classList.remove('active');
        });
    }

    if (contactSaveBtn && contactList) {
        // Save contact and add to the list
        contactSaveBtn.addEventListener('click', () => {
            const firstName = document.getElementById('contact-first-name').value.trim();
            const lastName = document.getElementById('contact-last-name').value.trim();
            const email = document.getElementById('contact-email').value.trim();

            if (firstName && lastName && email) {
                // Create a new contact element
                const contactItem = document.createElement('div');
                contactItem.className = 'contact-item';
                contactItem.innerHTML = `
                    <div class="contact-avatar">
                        <img src="/static/images/avatar.png" alt="${firstName} ${lastName}">
                    </div>
                    <div class="contact-details">
                        <div class="contact-name">${firstName} ${lastName}</div>
                        <div class="contact-email">${email}</div>
                    </div>
                `;

                // Append the new contact to the contact list
                contactList.appendChild(contactItem);

                // Close the modal
                newContactModal.classList.remove('active');

                // Clear input fields
                document.getElementById('contact-first-name').value = '';
                document.getElementById('contact-last-name').value = '';
                document.getElementById('contact-email').value = '';
            } else {
                alert('Пожалуйста, заполните все поля.');
            }
        });
    }
});
