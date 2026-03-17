using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PlzBuyMe.Api.Controllers;
using PlzBuyMe.Api.Dtos.Questions;
using PlzBuyMe.Api.Models;
using PlzBuyMe.Api.Services;
using PlzBuyMe.Tests.Helpers;
using Xunit;

namespace PlzBuyMe.Tests.Controllers;

public class QuestionsControllerTests
{
    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public async Task User_Can_Post_Question()
    {
        await using var db = CreateDbContext();
        var service = new QuestionsService(db);
        var user = new User
        {
            Username = "user1",
            Email = "user1@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = new QuestionsController(service);
        ControllerTestHelpers.SetUser(controller, user.Id, "end_user");

        var dto = new CreateQuestionDto
        {
            Subject = "Help",
            Body = "I have a question"
        };

        var result = await controller.Create(dto);

        result.Should().BeOfType<OkObjectResult>();
        var ok = (OkObjectResult)result;
        ok.Value.Should().BeOfType<QuestionResponseDto>();
        var response = (QuestionResponseDto)ok.Value!;
        response.Subject.Should().Be("Help");
        response.Body.Should().Be("I have a question");
        response.UserId.Should().Be(user.Id);
    }

    [Fact]
    public async Task Rep_Can_Reply_To_Question()
    {
        await using var db = CreateDbContext();
        var service = new QuestionsService(db);
        var endUser = new User
        {
            Username = "user1",
            Email = "user1@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser
        };
        var rep = new User
        {
            Username = "rep1",
            Email = "rep1@example.com",
            PasswordHash = "hash",
            Role = UserRole.CustomerRep
        };
        db.Users.AddRange(endUser, rep);
        await db.SaveChangesAsync();

        var question = new Question
        {
            UserId = endUser.Id,
            Subject = "Help",
            Body = "I have a question"
        };
        db.Questions.Add(question);
        await db.SaveChangesAsync();

        var controller = new QuestionsController(service);
        ControllerTestHelpers.SetUser(controller, rep.Id, "customer_rep");

        var dto = new ReplyDto
        {
            Body = "Here is an answer"
        };
        var result = await controller.Reply(question.Id, dto);

        result.Should().BeOfType<OkObjectResult>();
        var ok = (OkObjectResult)result;
        ok.Value.Should().BeOfType<QuestionResponseDto>();
        var response = (QuestionResponseDto)ok.Value!;
        response.Replies.Should().HaveCount(1);
        response.Replies[0].Body.Should().Be("Here is an answer");
        response.Replies[0].ReplierDisplayName.Should().Be("rep1");
        response.Replies[0].ReplierRole.Should().Be("customer_rep");
    }

    [Fact]
    public async Task Rep_Can_Add_Multiple_Replies_To_Question()
    {
        await using var db = CreateDbContext();
        var service = new QuestionsService(db);
        var endUser = new User
        {
            Username = "user2",
            Email = "user2@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser
        };
        var rep = new User
        {
            Username = "rep2",
            Email = "rep2@example.com",
            PasswordHash = "hash",
            Role = UserRole.CustomerRep
        };
        db.Users.AddRange(endUser, rep);
        await db.SaveChangesAsync();

        var question = new Question
        {
            UserId = endUser.Id,
            Subject = "Need help",
            Body = "First body"
        };
        db.Questions.Add(question);
        await db.SaveChangesAsync();

        var controller = new QuestionsController(service);
        ControllerTestHelpers.SetUser(controller, rep.Id, "customer_rep");

        await controller.Reply(question.Id, new ReplyDto { Body = "First answer" });
        var second = await controller.Reply(question.Id, new ReplyDto { Body = "Second answer" });

        second.Should().BeOfType<OkObjectResult>();
        var payload = (QuestionResponseDto)((OkObjectResult)second).Value!;
        payload.Replies.Should().HaveCount(2);
        payload.Replies.Select(r => r.Body).Should().ContainInOrder("First answer", "Second answer");
    }

    [Fact]
    public async Task Keyword_Search_Filters_Questions()
    {
        await using var db = CreateDbContext();
        var service = new QuestionsService(db);
        var user = new User
        {
            Username = "user1",
            Email = "user1@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        db.Questions.AddRange(
            new Question { UserId = user.Id, Subject = "Shipping question", Body = "When will it arrive?" },
            new Question { UserId = user.Id, Subject = "Payment issue", Body = "Card declined" }
        );
        await db.SaveChangesAsync();

        var controller = new QuestionsController(service);
        ControllerTestHelpers.SetUser(controller, user.Id, "end_user");

        var result = await controller.List("Shipping");

        result.Should().BeOfType<OkObjectResult>();
        var ok = (OkObjectResult)result;
        var items = ok.Value as IEnumerable<QuestionResponseDto>;
        items.Should().NotBeNull();
        items!.Should().ContainSingle(q => q.Subject.Contains("Shipping"));
    }
}

