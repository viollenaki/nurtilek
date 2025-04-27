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
        sidebar.addEventListener('click', function() {
            this.classList.toggle('expanded');
        });
    }

    // Кнопка нового чата
    const actionButton = document.querySelector('.action-button');
    if (actionButton) {
        actionButton.addEventListener('click', function() {
            // Здесь будет логика создания нового чата
            // В данном случае просто переадресуем на обработчик кнопки "новый чат"
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
        });
    }

    // Инициализация функционала поиска пользователей для нового чата
    const userSearchInput = document.getElementById('user-search-input');
    const searchResults = document.getElementById('search-results');
    const searchLoading = document.getElementById('search-loading');

    if (userSearchInput && searchResults) {
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
                        alert(`Чат с пользователем ${userData.nickname} успешно создан!`);
                        closeModal();
                        // В реальном приложении здесь нужно будет перенаправить на страницу чата
                        // или обновить список чатов
                        location.reload();  // Временное решение - перезагрузка страницы
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
});
