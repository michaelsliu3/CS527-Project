# Build: docker build -t plzbuyme-cdn .
# Persist uploads: mount a volume at /app/storage (see deploy/docker-compose.yml)
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY PlzBuyMe.Cdn.csproj .
RUN dotnet restore PlzBuyMe.Cdn.csproj
COPY . .
RUN dotnet publish PlzBuyMe.Cdn.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
VOLUME ["/app/storage"]
ENTRYPOINT ["dotnet", "PlzBuyMeCdnService.dll"]
