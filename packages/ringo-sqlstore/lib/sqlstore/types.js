/**
 * @fileoverview Module providing constructors for the various RDBMS data types.
 */

/**
 * Creates a new ColumnType instance
 * @class Instances of this class represent a database column, containing the
 * JDBC type, the SQL column type and optional settings (length, precision, scale)
 * @param {Number} jdbcType The JDBC type of the column
 * @param {String} sql The SQL string used to create the column
 * @param {Object} options Optional settings for the column
 * @returns A newly created ColumnType instance
 * @constructor
 */
var ColumnType = exports.ColumnType = function(jdbcType, sql, options) {

    Object.defineProperties(this, {
        /**
         * The JDBC type of this column type
         * @ignore
         */
        "jdbcType": {"value": jdbcType},
        /**
         * The SQL string used to create the column
         * @type String
         * @ignore
         */
        "sql": {"value": sql},
        /**
         * The optional settings of this column type
         * @ignore
         */
        "options": {"value": options || {}}
    });

    return this;
};

/** @ignore */
ColumnType.prototype.toString = function() {
    return "[ColumnType " + this.sql + "]";
};

/**
 * Returns the SQL statement fragment to create the column. Arguments override
 * any options defined in the database dialect.
 * @param {Number} length Optional length
 * @param {Number} precision Optional precision
 * @param {Number} scale Optional scale
 * @returns {String} The SQL statement fragment creating the column
 */
ColumnType.prototype.getSql = function(length, precision, scale) {
    var buf = [this.sql];
    if (length != null || this.options.length != null) {
        buf.push("(", length || this.options.length, ")");
    }
    if (precision != null || this.options.precision != null) {
        buf.push("(", precision || this.options.precision);
        if (scale != null || this.options.scale != null) {
            buf.push(", ", scale || this.options.scale);
        }
        buf.push(")");
    }
    return buf.join("");
};

/**
 * Returns a newly created IntegerType instance
 * @class Instances of this class represent an integer property type
 * @returns A newly created IntegerType instance
 * @constructor
 */
var IntegerType = exports.IntegerType = function() {
    return this;
};

/** @ignore */
IntegerType.prototype.toString = function() {
    return "[IntegerType]";
};

/**
 * Called to retrieve the value from a resultset
 * @param {java.sql.ResultSet} resultSet The resultset to retrieve the value from
 * @param {Number} idx The 1-based index position of the column
 * @returns {Number} The result set value at the given column index position
 */
IntegerType.prototype.get = function(resultSet, idx) {
    var value = resultSet.getLong(idx);
    if (resultSet.wasNull()) {
        return null;
    }
    return value;
};

/**
 * Sets the column value in the prepared statement
 * @param {java.sql.PreparedStatement} preparedStatement The statement
 * @param {Object} value The value
 * @param {Number} idx The 1-based index position of the column
 */
IntegerType.prototype.set = function(preparedStatement, value, idx) {
    return preparedStatement.setLong(idx, value);
};

/**
 * Returns a newly created FloatType instance
 * @class Instances of this class represent a float property type
 * @returns A newly created FloatType instance
 * @constructor
 */
var FloatType = exports.FloatType = function() {
    return this;
};

/** @ignore */
FloatType.prototype.toString = function() {
    return "[FloatType]";
};

/**
 * Called to retrieve the value from a resultset
 * @param {java.sql.ResultSet} resultSet The resultset to retrieve the value from
 * @param {Number} idx The 1-based index position of the column
 * @returns {Number} The result set value at the given column index position
 */
FloatType.prototype.get = function(resultSet, idx) {
    var value = resultSet.getDouble(idx);
    if (resultSet.wasNull()) {
        return null;
    }
    return value;
};

/**
 * Sets the column value in the prepared statement
 * @param {java.sql.PreparedStatement} preparedStatement The statement
 * @param {Object} value The value
 * @param {Number} idx The 1-based index position of the column
 */
FloatType.prototype.set = function(preparedStatement, value, idx) {
    return preparedStatement.setDouble(idx, value);
};

/**
 * Returns a newly created StringType instance
 * @class Instances of this class represent an character property type
 * @returns A newly created StringType instance
 * @constructor
 */
var StringType = exports.StringType = function() {
    return this;
};

/** @ignore */
StringType.prototype.toString = function() {
    return "[StringType]";
};

/**
 * Called to retrieve the value from a resultset
 * @param {java.sql.ResultSet} resultSet The resultset to retrieve the value from
 * @param {Number} idx The 1-based index position of the column
 * @returns {String} The result set value at the given column index position
 */
StringType.prototype.get = function(resultSet, idx) {
    try {
        return resultSet.getString(idx);
    } catch (e) {
        var reader = resultSet.getCharacterStream(idx);
        if (reader == null) {
            return null;
        }
        var out = new java.lang.StringBuilder();
        var buffer = new java.lang.reflect.Array.newInstance(java.lang.Character.TYPE, 2048);
        var read = -1;
        while ((read = reader.read(buffer)) > -1) {
            out.append(buffer, 0, read);
        }
        return out.toString();
    }
};

/**
 * Sets the column value in the prepared statement
 * @param {java.sql.PreparedStatement} preparedStatement The statement
 * @param {Object} value The value
 * @param {Number} idx The 1-based index position of the column
 */
StringType.prototype.set = function(preparedStatement, value, idx) {
    try {
        preparedStatement.setString(idx, value);
    } catch (e) {
        var reader = new StringReader(value);
        preparedStatement.setCharacterStream(idx, reader, value.length);
    }
};

/**
 * Returns a newly created BooleanType instance
 * @class Instances of this class represent a boolean property type
 * @returns A newly created BooleanType instance
 * @constructor
 */
var BooleanType = exports.BooleanType = function() {
    return this;
};

/** @ignore */
BooleanType.prototype.toString = function() {
    return "[BooleanType]";
};

/**
 * Called to retrieve the value from a resultset
 * @param {java.sql.ResultSet} resultSet The resultset to retrieve the value from
 * @param {Number} idx The 1-based index position of the column
 * @returns {Boolean} The result set value at the given column index position
 */
BooleanType.prototype.get = function(resultSet, idx) {
    return resultSet.getBoolean(idx);
};

/**
 * Sets the column value in the prepared statement
 * @param {java.sql.PreparedStatement} preparedStatement The statement
 * @param {Object} value The value
 * @param {Number} idx The 1-based index position of the column
 */
BooleanType.prototype.set = function(preparedStatement, value, idx) {
    preparedStatement.setBoolean(idx, value);
};

/**
 * Returns a newly created DateType instance
 * @class Instances of this class represent a date property type
 * @returns A newly created DateType instance
 * @constructor
 */
var DateType = exports.DateType = function() {
    return this;
};

/** @ignore */
DateType.prototype.toString = function() {
    return "[DateType]";
};

/**
 * Called to retrieve the value from a resultset
 * @param {java.sql.ResultSet} resultSet The resultset to retrieve the value from
 * @param {Number} idx The 1-based index position of the column
 * @returns {Date} The result set value at the given column index position
 */
DateType.prototype.get = function(resultSet, idx) {
    var date = resultSet.getDate(idx);
    if (date !== null) {
        return new Date(date.getTime());
    }
    return null;
};

/**
 * Sets the column value in the prepared statement
 * @param {java.sql.PreparedStatement} preparedStatement The statement
 * @param {Object} value The value
 * @param {Number} idx The 1-based index position of the column
 */
DateType.prototype.set = function(preparedStatement, value, idx) {
    var date = new java.sql.Date(value.getTime());
    return preparedStatement.setDate(idx, date);
};

/**
 * Returns a newly created TimeType instance
 * @class Instances of this class represent a time property type
 * @returns A newly created TimeType instance
 * @constructor
 */
var TimeType = exports.TimeType = function() {
    return this;
};

/** @ignore */
TimeType.prototype.toString = function() {
    return "[TimeType]";
};

/**
 * Called to retrieve the value from a resultset
 * @param {java.sql.ResultSet} resultSet The resultset to retrieve the value from
 * @param {Number} idx The 1-based index position of the column
 * @returns {Date} The result set value at the given column index position
 */
TimeType.prototype.get = function(resultSet, idx) {
    var time = resultSet.getTime(idx);
    if (time !== null) {
        return new Date(time.getTime());
    }
    return null;
};

/**
 * Sets the column value in the prepared statement
 * @param {java.sql.PreparedStatement} preparedStatement The statement
 * @param {Object} value The value
 * @param {Number} idx The 1-based index position of the column
 */
TimeType.prototype.set = function(preparedStatement, value, idx) {
    var time = new java.sql.Time(value.getTime());
    return preparedStatement.setTime(idx, time);
};

/**
 * Returns a newly created TimestampType instance
 * @class Instances of this class represent a timestamp property type
 * @returns A newly created TimestampType instance
 * @constructor
 */
var TimestampType = exports.TimestampType = function() {
    return this;
};

/** @ignore */
TimestampType.prototype.toString = function() {
    return "[TimestampType]";
};

/**
 * Called to retrieve the value from a resultset
 * @param {java.sql.ResultSet} resultSet The resultset to retrieve the value from
 * @param {Number} idx The 1-based index position of the column
 * @returns {Date} The result set value at the given column index position
 */
TimestampType.prototype.get = function(resultSet, idx) {
    var timestamp = resultSet.getTimestamp(idx);
    if (timestamp !== null) {
        return new Date(timestamp.getTime());
    }
    return null;
};

/**
 * Sets the column value in the prepared statement
 * @param {java.sql.PreparedStatement} preparedStatement The statement
 * @param {Object} value The value
 * @param {Number} idx The 1-based index position of the column
 */
TimestampType.prototype.set = function(preparedStatement, value, idx) {
    var ts = new java.sql.Timestamp(value.getTime());
    return preparedStatement.setTimestamp(idx, ts);
};

/**
 * Returns a newly created BinaryType instance
 * @class Instances of this class represent a binary property type
 * @returns A newly created BinaryType instance
 * @constructor
 */
var BinaryType = exports.BinaryType = function() {
    return this;
};

/** @ignore */
BinaryType.prototype.toString = function() {
    return "[BinaryType]";
};

/**
 * Called to retrieve the value from a resultset
 * @param {java.sql.ResultSet} resultSet The resultset to retrieve the value from
 * @param {Number} idx The 1-based index position of the column
 * @returns {ByteArray} The result set value at the given column index position
 */
BinaryType.prototype.get = function(resultSet, idx) {
    var inStream = resultSet.getBinaryStream(idx);
    if (inStream == null) {
        return null;
    }
    var out = new java.io.ByteArrayOutputStream();
    var buffer = new java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 2048);
    var read = -1;
    while ((read = inStream.read(buffer)) > -1) {
        out.write(buffer, 0, read);
    }
    return out.toByteArray();
};

/**
 * Sets the column value in the prepared statement
 * @param {java.sql.PreparedStatement} preparedStatement The statement
 * @param {Object} value The value
 * @param {Number} idx The 1-based index position of the column
 */
BinaryType.prototype.set = function(preparedStatement, value, idx) {
    if (value.getClass().getComponentType().equals(java.lang.Byte.TYPE)) {
        try {
            preparedStatement.setBytes(idx, value);
        } catch (e) {
            var buf = (new java.lang.String(value)).getBytes();
            var stream = new java.io.ByteArrayInputStream(buf);
            preparedStatement.setBinaryStream(idx, stream, buf.length);
        }
    } else {
        throw new Error("Expected byte[] for binary column");
    }
};
