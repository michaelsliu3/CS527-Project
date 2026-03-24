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
            AvatarUrl = "avatars/user1.png",
            Email = "user1@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser
        };
        var rep = new User
        {
            Username = "rep1",
            AvatarUrl = "avatars/rep1.png",
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
        response.Replies[0].ReplierAvatarUrl.Should().Be("avatars/rep1.png");
        response.Replies[0].ReplierRole.Should().Be("customer_rep");
        response.UsernameAvatarUrl.Should().Be("avatars/user1.png");
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

    [Fact]
    public async Task Keyword_Search_Matches_Reply_Body()
    {
        await using var db = CreateDbContext();
        var service = new QuestionsService(db);

        var endUser = new User
        {
            Username = "user-reply-body",
            Email = "user-reply-body@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser
        };
        var rep = new User
        {
            Username = "rep-reply-body",
            Email = "rep-reply-body@example.com",
            PasswordHash = "hash",
            Role = UserRole.CustomerRep
        };
        db.Users.AddRange(endUser, rep);
        await db.SaveChangesAsync();

        var question = new Question
        {
            UserId = endUser.Id,
            Subject = "General question",
            Body = "Need assistance"
        };
        db.Questions.Add(question);
        await db.SaveChangesAsync();

        db.QuestionReplies.Add(new QuestionReply
        {
            QuestionId = question.Id,
            RepliedByUserId = rep.Id,
            Body = "Tracking update: shipment delayed by weather",
            ReplierDisplayName = rep.Username,
            ReplierRole = "customer_rep",
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var controller = new QuestionsController(service);
        ControllerTestHelpers.SetUser(controller, endUser.Id, "end_user");

        var result = await controller.List("weather");

        result.Should().BeOfType<OkObjectResult>();
        var ok = (OkObjectResult)result;
        var items = ok.Value as IEnumerable<QuestionResponseDto>;
        items.Should().NotBeNull();
        items!.Should().ContainSingle(q => q.Id == question.Id);
    }

    [Fact]
    public async Task Keyword_Search_Matches_Replier_Display_Name()
    {
        await using var db = CreateDbContext();
        var service = new QuestionsService(db);

        var endUser = new User
        {
            Username = "user-reply-name",
            Email = "user-reply-name@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser
        };
        var rep = new User
        {
            Username = "special-helper-rep",
            Email = "special-helper-rep@example.com",
            PasswordHash = "hash",
            Role = UserRole.CustomerRep
        };
        db.Users.AddRange(endUser, rep);
        await db.SaveChangesAsync();

        var question = new Question
        {
            UserId = endUser.Id,
            Subject = "Billing question",
            Body = "Invoice mismatch"
        };
        db.Questions.Add(question);
        await db.SaveChangesAsync();

        db.QuestionReplies.Add(new QuestionReply
        {
            QuestionId = question.Id,
            RepliedByUserId = rep.Id,
            Body = "Please recheck the latest invoice details.",
            ReplierDisplayName = rep.Username,
            ReplierRole = "customer_rep",
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var controller = new QuestionsController(service);
        ControllerTestHelpers.SetUser(controller, endUser.Id, "end_user");

        var result = await controller.List("helper");

        result.Should().BeOfType<OkObjectResult>();
        var ok = (OkObjectResult)result;
        var items = ok.Value as IEnumerable<QuestionResponseDto>;
        items.Should().NotBeNull();
        items!.Should().ContainSingle(q => q.Id == question.Id);
    }

    [Fact]
    public async Task User_Can_Toggle_And_Update_Question_Vote()
    {
        await using var db = CreateDbContext();
        var service = new QuestionsService(db);

        var user = new User
        {
            Username = "vote-user",
            Email = "vote-user@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var question = new Question
        {
            UserId = user.Id,
            Subject = "Voting",
            Body = "test"
        };
        db.Questions.Add(question);
        await db.SaveChangesAsync();

        var first = await service.VoteQuestionAsync(question.Id, user.Id, 1);
        first!.Score.Should().Be(1);
        first.CurrentUserVote.Should().Be(1);

        var toggled = await service.VoteQuestionAsync(question.Id, user.Id, 1);
        toggled!.Score.Should().Be(0);
        toggled.CurrentUserVote.Should().Be(0);

        var switched = await service.VoteQuestionAsync(question.Id, user.Id, -1);
        switched!.Score.Should().Be(-1);
        switched.CurrentUserVote.Should().Be(-1);
    }

    [Fact]
    public async Task Vote_On_Reply_Updates_Aggregated_Score()
    {
        await using var db = CreateDbContext();
        var service = new QuestionsService(db);

        var endUser = new User
        {
            Username = "reply-owner",
            Email = "reply-owner@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser
        };
        var voter = new User
        {
            Username = "reply-voter",
            Email = "reply-voter@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser
        };
        db.Users.AddRange(endUser, voter);
        await db.SaveChangesAsync();

        var question = new Question { UserId = endUser.Id, Subject = "s", Body = "b" };
        db.Questions.Add(question);
        await db.SaveChangesAsync();

        db.QuestionReplies.Add(new QuestionReply
        {
            QuestionId = question.Id,
            RepliedByUserId = endUser.Id,
            Body = "reply",
            ReplierDisplayName = endUser.Username
        });
        await db.SaveChangesAsync();
        var replyId = db.QuestionReplies.Single().Id;

        var voted = await service.VoteReplyAsync(replyId, voter.Id, 1);
        voted.Should().NotBeNull();
        voted!.Replies.Should().ContainSingle();
        voted.Replies[0].Score.Should().Be(1);
        voted.Replies[0].CurrentUserVote.Should().Be(1);
    }

    [Fact]
    public async Task Thread_Retrieval_And_Top_Sort_Are_Deterministic()
    {
        await using var db = CreateDbContext();
        var service = new QuestionsService(db);

        var owner = new User
        {
            Username = "owner",
            Email = "owner@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser
        };
        var voter1 = new User
        {
            Username = "v1",
            Email = "v1@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser
        };
        var voter2 = new User
        {
            Username = "v2",
            Email = "v2@example.com",
            PasswordHash = "hash",
            Role = UserRole.EndUser
        };
        db.Users.AddRange(owner, voter1, voter2);
        await db.SaveChangesAsync();

        var olderQuestion = new Question
        {
            UserId = owner.Id,
            Subject = "Older",
            Body = "older",
            CreatedAt = DateTime.UtcNow.AddMinutes(-20)
        };
        var newerQuestion = new Question
        {
            UserId = owner.Id,
            Subject = "Newer",
            Body = "newer",
            CreatedAt = DateTime.UtcNow.AddMinutes(-10)
        };
        db.Questions.AddRange(olderQuestion, newerQuestion);
        await db.SaveChangesAsync();

        var parentReply = new QuestionReply
        {
            QuestionId = newerQuestion.Id,
            RepliedByUserId = owner.Id,
            Body = "parent",
            ReplierDisplayName = owner.Username,
            CreatedAt = DateTime.UtcNow.AddMinutes(-9)
        };
        db.QuestionReplies.Add(parentReply);
        await db.SaveChangesAsync();

        db.QuestionReplies.Add(new QuestionReply
        {
            QuestionId = newerQuestion.Id,
            ParentReplyId = parentReply.Id,
            RepliedByUserId = owner.Id,
            Body = "child",
            ReplierDisplayName = owner.Username,
            CreatedAt = DateTime.UtcNow.AddMinutes(-8)
        });
        await db.SaveChangesAsync();

        await service.VoteQuestionAsync(olderQuestion.Id, voter1.Id, 1);
        await service.VoteQuestionAsync(olderQuestion.Id, voter2.Id, 1);
        await service.VoteQuestionAsync(newerQuestion.Id, voter1.Id, 1);

        var topSorted = await service.GetQuestionsAsync(null, owner.Id, "top");
        topSorted.Select(q => q.Id).Should().ContainInOrder(olderQuestion.Id, newerQuestion.Id);
        topSorted[1].Replies.Should().ContainSingle();
        topSorted[1].Replies[0].Replies.Should().ContainSingle(r => r.Body == "child");
    }
}

