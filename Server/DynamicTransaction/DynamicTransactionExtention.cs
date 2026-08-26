using DynamicTransaction.Interfaces;
using DynamicTransaction.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace DynamicTransaction;

public static class DynamicTransactionExtension
{
    public static IServiceCollection AddDynamicQueryInfrastructure<TFactory>(this IServiceCollection services)
        where TFactory : class, IDbConnectionFactory
    {
        services.TryAddScoped<IDbConnectionFactory, TFactory>();
        services.TryAddScoped<IDynamicQueryExecutor, DynamicQueryExecutor>();

        return services;
    }
}
