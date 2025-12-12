document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const companyName = document.getElementById('companyName').value;
        const contactPerson = document.getElementById('contactPerson').value;
        const phone = document.getElementById('phone').value;

        // Clear messages
        errorMessage.classList.remove('show');
        successMessage.classList.remove('show');

        // Validate passwords match
        if (password !== confirmPassword) {
            showError('Passwords do not match');
            return;
        }

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username,
                    email,
                    password,
                    companyName,
                    contactPerson,
                    phone,
                    customerType: 'b2b',
                }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                showSuccess(data.message + ' You will be redirected to the login page shortly.');
                registerForm.reset();

                // Redirect to login after 5 seconds (give time to read the message)
                setTimeout(() => {
                    window.location.href = '/admin/login';
                }, 5000);
            } else {
                showError(data.message || 'Registration failed');
            }
        } catch (error) {
            showError('An error occurred. Please try again.');
            console.error('Registration error:', error);
        }
    });

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.add('show');

        setTimeout(() => {
            errorMessage.classList.remove('show');
        }, 5000);
    }

    function showSuccess(message) {
        successMessage.textContent = message;
        successMessage.classList.add('show');
    }
});
