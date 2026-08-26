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

    // Add services to the container.
    builder.Services.AddControllers()
        .AddNewtonsoftJson(); // To support JObject parameters model binding

    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen();

    // Get Connection String via external ConnectionDll wrapper
    var oracleService = new OracleService();
    var connectionString = oracleService.GetConnectionString();
    builder.Services.AddSingleton(oracleService);

    // Register DynamicTransaction library dependency injection
    builder.Services.AddDynamicQueryInfrastructure<AppOracleDbConnectionFactory>();
    builder.Services.AddScoped<AppOracleDbConnectionFactory>(sp => new AppOracleDbConnectionFactory(connectionString));
    builder.Services.AddScoped<DynamicTransaction.Interfaces.IDbConnectionFactory>(sp => sp.GetRequiredService<AppOracleDbConnectionFactory>());

    // Register application services
    builder.Services.AddScoped<ISalesPlanServices, SalesPlanService>();

    var app = builder.Build();

    // Configure the HTTP request pipeline.
    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI();
    }

    app.UseHttpsRedirection();

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
