# Build: docker build -t plzbuyme-api .
# Run:  see deploy/docker-compose.yml
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY PlzBuyMe.Api.csproj .
RUN dotnet restore PlzBuyMe.Api.csproj
COPY . .
RUN dotnet publish PlzBuyMe.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "PlzBuyMe.Api.dll"]
