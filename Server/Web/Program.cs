using Serilog;
using Server.Interfaces;
using Server.Services;
using Server.Infrastructure.Data.ExternalSources;
using ServerInfrastructure.Data;
using DynamicTransaction;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .Enrich.FromLogContext()
    .CreateLogger();

try
{
    Log.Information("Starting Web API host...");
    var builder = WebApplication.CreateBuilder(args);

    builder.Host.UseSerilog();

    builder.Services.AddCors(options =>
    {
        options.AddPolicy("AllowAll", policy =>
        {
            policy.AllowAnyOrigin()
                  .AllowAnyMethod()
                  .AllowAnyHeader();
        });
    });

    builder.Services.AddControllers()
        .AddNewtonsoftJson();

    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen();

    var oracleService = new OracleService();
    var connectionString = oracleService.GetConnectionString();

    builder.Services.AddSingleton(oracleService);
    builder.Services.AddScoped(sp => new AppOracleDbConnectionFactory(connectionString));

    builder.Services.AddDynamicQueryInfrastructure<AppOracleDbConnectionFactory>();

    builder.Services.AddScoped<IAuthServices, AuthServices>();
    builder.Services.AddScoped<ISalesPlanServices, SalesPlanService>();

    var app = builder.Build();

    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI();
    }

    app.UseHttpsRedirection();
    app.UseCors("AllowAll");
    app.UseAuthorization();
    app.MapControllers();

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Host terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
