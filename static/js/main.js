/**
 * Основной JS файл для функциональности главной страницы
 */

document.addEventListener('DOMContentLoaded', function() {
    // Переменные для элементов интерфейса
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    
    // Создаем элемент для эффекта вспышки при смене темы
    const flashElement = document.createElement('div');
    flashElement.className = 'theme-flash';
    document.body.appendChild(flashElement);
    
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
        // Активируем эффект вспышки
        flashElement.classList.add('active');
        
        // Переключаем тему
        document.body.classList.toggle('dark-theme');
        document.body.classList.toggle('light-theme');
        
        // Меняем иконку темы
        if(document.body.classList.contains('dark-theme')) {
            themeIcon.src = '/static/images/moon.png';
            localStorage.setItem('theme', 'dark');
        } else {
            themeIcon.src = '/static/images/sun.png';
            localStorage.setItem('theme', 'light');
        }
        
        // Удаляем класс активности для вспышки
        setTimeout(() => {
            flashElement.classList.remove('active');
        }, 700); // Должно соответствовать продолжительности анимации
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

    // Функционал бокового меню опций
    const optionsMenuBtn = document.getElementById('options-menu-btn');
    const chatOptionsMenuBtn = document.getElementById('chat-options-menu-btn');
    const optionsDrawer = document.getElementById('options-drawer');
    const drawerCloseBtn = document.getElementById('drawer-close-btn');
    const drawerOverlay = document.getElementById('drawer-overlay');
    
    // Открытие бокового меню
    optionsMenuBtn?.addEventListener('click', function() {
        optionsDrawer.classList.add('active');
    });
    
    // Открытие бокового меню при клике на иконку в заголовке чата
    chatOptionsMenuBtn?.addEventListener('click', function() {
        optionsDrawer.classList.add('active');
    });
    
    // Закрытие бокового меню
    function closeDrawer() {
        optionsDrawer.classList.remove('active');
    }
    
    drawerCloseBtn?.addEventListener('click', closeDrawer);
    drawerOverlay?.addEventListener('click', closeDrawer);
    
    // При клике вне меню закрываем его
    document.addEventListener('click', function(event) {
        if (optionsDrawer.classList.contains('active') && 
            !optionsDrawer.contains(event.target) && 
            event.target !== optionsMenuBtn && 
            event.target !== chatOptionsMenuBtn) {
            closeDrawer();
        }
    });
    
    // Обработчики для элементов меню
    document.querySelectorAll('.drawer-item').forEach(item => {
        item.addEventListener('click', function() {
            const action = this.querySelector('.drawer-item-text').textContent;
            switch(action) {
                case 'Shared photos':
                    console.log('Opening shared photos');
                    break;
                case 'Shared files':
                    console.log('Opening shared files');
                    break;
                case 'Shared links':
                    console.log('Opening shared links');
                    break;
                case 'Block user':
                    if(confirm('Вы действительно хотите заблокировать этого пользователя?')) {
                        console.log('User blocked');
                    }
                    break;
            }
            closeDrawer();
        });
    });

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
        const lastGroupId = localStorage.getItem('lastGroupId');
        
        if (lastChatId && lastChatType && lastChatName) {
            setTimeout(() => {
                window.chatModule.openChat(lastChatId, lastChatType, lastChatName, lastGroupId);
            }, 1000);
        }
    }

    // Обработка выпадающего меню пользователя
    const optionsDropdown = document.getElementById('options-dropdown');
    
    // Показать/скрыть выпадающее меню при клике на иконку
    optionsMenuBtn?.addEventListener('click', function(e) {
        e.stopPropagation(); // Предотвращаем всплытие события
        optionsDropdown.classList.toggle('active');
    });
    
    // Скрыть меню при клике в любом месте страницы
    document.addEventListener('click', function(e) {
        if (optionsDropdown && optionsDropdown.classList.contains('active') && 
            !optionsDropdown.contains(e.target)) {
            optionsDropdown.classList.remove('active');
        }
    });
    
    // Обработчик для кнопки выхода
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            // Здесь можно добавить запрос на сервер для выхода
            fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    window.location.href = '/login';
                } else {
                    console.error('Ошибка при выходе:', data.message);
                }
            })
            .catch(error => {
                console.error('Ошибка при выходе:', error);
            });
        });
    }
    
    // Обработчик для кнопки настроек профиля
    const profileSettingsBtn = document.getElementById('profile-settings-btn');
    if (profileSettingsBtn) {
        profileSettingsBtn.addEventListener('click', function() {
            // Закрываем выпадающее меню
            optionsDropdown.classList.remove('active');
            
            // Открываем модальное окно редактирования профиля
            const profileModal = document.getElementById('edit-profile-modal');
            if (profileModal) {
                profileModal.classList.add('active');
            }
        });
    }
});
