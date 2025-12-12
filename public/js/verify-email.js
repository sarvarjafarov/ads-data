document.addEventListener('DOMContentLoaded', async () => {
    const loadingState = document.getElementById('loadingState');
    const successState = document.getElementById('successState');
    const errorState = document.getElementById('errorState');
    const errorMessage = document.getElementById('errorMessage');
    const resendSection = document.getElementById('resendSection');
    const resendForm = document.getElementById('resendForm');

    // Get token from URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        showError('No verification token provided. Please check your email for the verification link.');
        return;
    }

    // Verify the email
    try {
        const response = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showSuccess();
        } else {
            showError(data.message || 'Email verification failed. Please try again.');

            // Show resend section if token is invalid/expired
            if (data.message && (data.message.includes('expired') || data.message.includes('Invalid'))) {
                resendSection.classList.add('show');
            }
        }
    } catch (error) {
        console.error('Verification error:', error);
        showError('An error occurred during verification. Please try again later.');
    }

    // Handle resend verification form
    resendForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const submitButton = resendForm.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;

        submitButton.disabled = true;
        submitButton.textContent = 'Sending...';

        try {
            const response = await fetch('/api/auth/resend-verification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                errorMessage.textContent = 'Verification email sent! Please check your inbox and click the new verification link.';
                errorMessage.style.color = '#22c55e';
                resendSection.classList.remove('show');
            } else {
                alert(data.message || 'Failed to send verification email. Please try again.');
            }
        } catch (error) {
            console.error('Resend error:', error);
            alert('An error occurred. Please try again.');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    });

    function showSuccess() {
        loadingState.style.display = 'none';
        errorState.classList.remove('show');
        successState.classList.add('show');
    }

    function showError(message) {
        loadingState.style.display = 'none';
        successState.classList.remove('show');
        errorMessage.textContent = message;
        errorState.classList.add('show');
    }
});
