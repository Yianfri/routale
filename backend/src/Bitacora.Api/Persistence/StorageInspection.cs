using System.Xml;
using System.Xml.Linq;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Bitacora.Api.Persistence;

public static class StorageInspection
{
    public static void Verify(string directory)
    {
        var root = Path.GetFullPath(directory);
        if (!Directory.Exists(root))
        {
            throw new InvalidOperationException("No existe el almacenamiento que se quiere comprobar.");
        }

        RejectLinks(root);
        var path = Path.Combine(root, "bitacora.db");
        if (!File.Exists(path) || new FileInfo(path).Length < 100)
        {
            throw new InvalidOperationException("Falta una base SQLite válida; no se creó ni reemplazó ningún archivo.");
        }

        var keysDirectory = Path.Combine(root, "keys");
        var keys = Directory.Exists(keysDirectory) ? Directory.GetFiles(keysDirectory, "*.xml") : [];
        if (keys.Length == 0)
        {
            throw new InvalidOperationException("Faltan los archivos de claves persistentes de la instalación.");
        }

        var hasKey = false;
        foreach (var key in keys)
        {
            using var reader = XmlReader.Create(key, new XmlReaderSettings
            {
                DtdProcessing = DtdProcessing.Prohibit,
                XmlResolver = null,
                MaxCharactersInDocument = 1024 * 1024
            });
            var document = XDocument.Load(reader);
            if (document.Root?.Name.LocalName == "revocation")
            {
                continue;
            }

            if (document.Root?.Name.LocalName != "key" || !Guid.TryParse((string?)document.Root.Attribute("id"), out _))
            {
                throw new InvalidOperationException("Un archivo de claves no tiene el formato esperado.");
            }

            hasKey = true;
        }

        if (!hasKey)
        {
            throw new InvalidOperationException("La carpeta solo contiene revocaciones; faltan las claves de la instalación.");
        }

        // No crear una base vacía ni migrar una copia durante su comprobación.
        var connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = path,
            Mode = SqliteOpenMode.ReadOnly,
            Pooling = false
        }.ToString();
        using var connection = new SqliteConnection(connectionString);
        connection.Open();
        using var command = connection.CreateCommand();
        command.CommandText = "PRAGMA integrity_check";
        using (var reader = command.ExecuteReader())
        {
            if (!reader.Read() || reader.GetString(0) != "ok" || reader.Read())
            {
                throw new InvalidOperationException("La comprobación de integridad de SQLite falló.");
            }
        }

        command.CommandText = "PRAGMA foreign_key_check";
        using (var reader = command.ExecuteReader())
        {
            if (reader.Read())
            {
                throw new InvalidOperationException("La copia contiene relaciones de base de datos inválidas.");
            }
        }

        using var context = new BitacoraDbContext(new DbContextOptionsBuilder<BitacoraDbContext>()
            .UseSqlite(connectionString).Options);
        LegacySchema.RequireKnownVersion(context);
        if (context.Database.GetPendingMigrations().Any())
        {
            throw new InvalidOperationException("El esquema no coincide con esta imagen; no se aplicaron migraciones.");
        }
    }

    private static void RejectLinks(string path)
    {
        var attributes = File.GetAttributes(path);
        if ((attributes & FileAttributes.ReparsePoint) != 0)
        {
            throw new InvalidOperationException("El almacenamiento contiene un enlace; se conserva sin seguirlo.");
        }

        if ((attributes & FileAttributes.Directory) != 0)
        {
            foreach (var entry in Directory.EnumerateFileSystemEntries(path))
            {
                RejectLinks(entry);
            }
        }
    }
}
