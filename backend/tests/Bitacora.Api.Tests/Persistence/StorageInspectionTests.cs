using Bitacora.Api.Persistence;
using Microsoft.Data.Sqlite;

namespace Bitacora.Api.Tests.Persistence;

public sealed class StorageInspectionTests
{
    [Fact]
    public void MissingStorageDoesNotCreateAnEmptyDatabase()
    {
        using var fixture = new DatabaseFixture();
        Assert.Throws<InvalidOperationException>(() => StorageInspection.Verify(fixture.Database.DirectoryPath));
        Assert.False(File.Exists(Path.Combine(fixture.Database.DirectoryPath, "bitacora.db")));
    }

    [Fact]
    public void CorruptDatabaseIsRejectedWithoutReplacingItsBytes()
    {
        using var fixture = new DatabaseFixture();
        WriteKey(fixture);
        var path = Path.Combine(fixture.Database.DirectoryPath, "bitacora.db");
        var bytes = new byte[128];
        File.WriteAllBytes(path, bytes);
        Assert.Throws<SqliteException>(() => StorageInspection.Verify(fixture.Database.DirectoryPath));
        Assert.Equal(bytes, File.ReadAllBytes(path));
    }

    [Fact]
    public void RequiresKeysAndChecksTheExistingSchemaWithoutMigrating()
    {
        using var fixture = new DatabaseFixture();
        fixture.Database.Migrate(fixture.Factory);
        Assert.Throws<InvalidOperationException>(() => StorageInspection.Verify(fixture.Database.DirectoryPath));
        WriteKey(fixture);
        File.WriteAllText(Path.Combine(fixture.Database.DirectoryPath, "keys", "revocation-example.xml"),
            "<revocation version=\"1\"><key id=\"*\" /></revocation>");
        StorageInspection.Verify(fixture.Database.DirectoryPath);

        using var connection = new SqliteConnection(fixture.Database.ConnectionString);
        connection.Open();
        using var command = connection.CreateCommand();
        command.CommandText = "INSERT INTO __EFMigrationsHistory VALUES('99990101000000_Future', '99.0.0')";
        command.ExecuteNonQuery();
        Assert.Throws<InvalidOperationException>(() => StorageInspection.Verify(fixture.Database.DirectoryPath));
    }

    [Fact]
    public void RejectsBrokenRelationsAndLeavesTheCopyIntact()
    {
        using var fixture = new DatabaseFixture();
        fixture.Database.Migrate(fixture.Factory);
        WriteKey(fixture);
        using var connection = new SqliteConnection(fixture.Database.ConnectionString);
        connection.Open();
        using var command = connection.CreateCommand();
        command.CommandText = "PRAGMA foreign_keys=OFF; INSERT INTO sessions VALUES('orphan', 'missing', '2030-06-03T17:00:00Z')";
        command.ExecuteNonQuery();
        Assert.Throws<InvalidOperationException>(() => StorageInspection.Verify(fixture.Database.DirectoryPath));
        command.CommandText = "SELECT COUNT(*) FROM sessions WHERE id='orphan'";
        Assert.Equal(1L, command.ExecuteScalar());
    }

    private static void WriteKey(DatabaseFixture fixture)
    {
        var directory = Path.Combine(fixture.Database.DirectoryPath, "keys");
        Directory.CreateDirectory(directory);
        File.WriteAllText(Path.Combine(directory, "key-example.xml"), $"<key id=\"{Guid.NewGuid()}\" version=\"1\"><descriptor /></key>");
    }
}
