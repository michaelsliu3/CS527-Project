using PlzBuyMe.Api.Dtos.Auth;

namespace PlzBuyMe.Api.Controllers;

internal static class AuthControllerHelper
{
    public static AuthErrorDto ToErrorDto(LoginFailureReason reason)
    {
        return reason switch
        {
            LoginFailureReason.UserNotFound => new AuthErrorDto
            {
                Code = nameof(LoginFailureReason.UserNotFound),
                Message = "No account found with that username or email."
            },
            LoginFailureReason.InvalidPassword => new AuthErrorDto
            {
                Code = nameof(LoginFailureReason.InvalidPassword),
                Message = "Incorrect password."
            },
            LoginFailureReason.AccountInactive => new AuthErrorDto
            {
                Code = nameof(LoginFailureReason.AccountInactive),
                Message = "This account has been deactivated. Contact support if you need access."
            },
            _ => new AuthErrorDto { Code = "LoginFailed", Message = "Login failed. Please try again." }
        };
    }

    public static AuthErrorDto ToErrorDto(RegisterFailureReason reason)
    {
        return reason switch
        {
            RegisterFailureReason.UsernameTaken => new AuthErrorDto
            {
                Code = nameof(RegisterFailureReason.UsernameTaken),
                Message = "That username is already taken. Please choose another."
            },
            RegisterFailureReason.EmailTaken => new AuthErrorDto
            {
                Code = nameof(RegisterFailureReason.EmailTaken),
                Message = "An account with that email already exists. Try logging in instead."
            },
            _ => new AuthErrorDto { Code = "RegisterFailed", Message = "Registration failed. Please try again." }
        };
    }
}
