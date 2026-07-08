import org.bouncycastle.asn1.*;
import org.bouncycastle.asn1.x509.AlgorithmIdentifier;
import org.bouncycastle.crypto.PBEParametersGenerator;
import org.bouncycastle.crypto.digests.SHA1Digest;
import org.bouncycastle.crypto.generators.PKCS5S1ParametersGenerator;
import org.bouncycastle.crypto.params.KeyParameter;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import javax.crypto.*;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.*;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.security.*;
import java.security.cert.CertificateFactory;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;

public final class KotsaSecurity {
    static {
        Security.addProvider( new BouncyCastleProvider() );
    }
    private static final int BUFFER_SIZE = 4096;
    private final String publicKeyFile;
    private final String privateKeyFile;
    private final String privateKeyPassword;

    public KotsaSecurity( String publicKeyFile, String privateKeyFile, String privateKeyPassword ) {
        this.publicKeyFile = publicKeyFile;
        this.privateKeyFile = privateKeyFile;
        this.privateKeyPassword = privateKeyPassword;
    }

    private byte[] dataPacking( byte[] encryptedKey, byte[] encryptedIv, byte[] signedData, byte[] encryptedData )
            throws IOException {
        ASN1EncodableVector vector = new ASN1EncodableVector();
        vector.add( new DEROctetString(encryptedKey) );
        vector.add( new DEROctetString(encryptedIv) );
        vector.add( new DEROctetString(signedData) );
        vector.add( new DEROctetString(encryptedData) );
        return new DERSequence( vector ).getEncoded();
    }

    private List dataUnpacking( byte[] packagedData ) throws IOException {
        try( ASN1InputStream is = new ASN1InputStream(packagedData) ) {
            ASN1Sequence asn1Sequence = (ASN1Sequence)is.readObject();
            return Arrays.asList(
                    ((DEROctetString)asn1Sequence.getObjectAt( 0 )).getOctets()
                    , ((DEROctetString)asn1Sequence.getObjectAt( 1 )).getOctets()
                    , ((DEROctetString)asn1Sequence.getObjectAt( 2 )).getOctets()
                    , ((DEROctetString)asn1Sequence.getObjectAt( 3 )).getOctets()
            );
        }
    }

    private byte[] decode( byte[] data ) {
        return Base64.getDecoder().decode( data );
    }

    private byte[] decryptByPrivateKey( PrivateKey privateKey, byte[] encryptedData ) throws Exception {
        Cipher cipher = Cipher.getInstance( "RSA" );
        cipher.init( Cipher.DECRYPT_MODE, privateKey );
        return cipher.doFinal( encryptedData );
    }

    private byte[] decryptByKey( SecretKey key, IvParameterSpec iv, byte[] encryptedMessage ) throws Exception {
        Cipher cipher = Cipher.getInstance( "SEED/CBC/PKCS5Padding", "BC" );
        cipher.init( Cipher.DECRYPT_MODE, key, iv );
        return cipher.doFinal( encryptedMessage );
    }

    private byte[] encode( byte[] data ) {
        return Base64.getEncoder().encode( data );
    }

    private byte[] encryptByPublicKey( PublicKey publicKey, byte[] data ) throws Exception {
        Cipher cipher = Cipher.getInstance( "RSA" );
        cipher.init( Cipher.ENCRYPT_MODE, publicKey );
        return cipher.doFinal( data );
    }

    private byte[] encryptByKey( SecretKey key, IvParameterSpec iv, String message ) throws Exception {
        Cipher cipher = Cipher.getInstance( "SEED/CBC/PKCS5Padding", "BC" );
        cipher.init( Cipher.ENCRYPT_MODE, key, iv );
        return cipher.doFinal( message.getBytes() );
    }

    private byte[] extractFileHash( File file ) throws Exception {
        MessageDigest sha256 = MessageDigest.getInstance( "SHA-256" );
        byte[] hash;
        try( DigestInputStream dis = new DigestInputStream( new FileInputStream(file), sha256) ) {
            byte[] buffer = new byte[ BUFFER_SIZE ];
            while( dis.read(buffer) > 0 ) {}
            hash = sha256.digest();
        }
        return hash;
    }

    private IvParameterSpec generateIv() {
        byte[] ivBytes = new byte[ 16 ];
        new SecureRandom().nextBytes( ivBytes );
        return new IvParameterSpec( ivBytes );
    }

    private SecretKey generateKey() throws Exception {
        KeyGenerator keyGenerator = KeyGenerator.getInstance( "SEED", "BC" );
        keyGenerator.init( 128 );
        return keyGenerator.generateKey();
    }

    private byte[] sign( PrivateKey privateKey, byte[] encryptedData ) throws Exception {
       Signature sig = Signature.getInstance( "SHA256withRSA" );
       sig.initSign( privateKey );
       sig.update( encryptedData );
       return sig.sign();
    }

    private boolean verify( PublicKey publicKey, byte[] verifyData, byte[] signData ) throws Exception {
        Signature sig = Signature.getInstance( "SHA256withRSA" );
        sig.initVerify( publicKey );
        sig.update( verifyData );
        return sig.verify( signData );
    }

    private PrivateKey readPrivateKey() throws Exception {
        try( ASN1InputStream is = new ASN1InputStream( Files.newInputStream(Paths.get(privateKeyFile))) ) {
            ASN1Sequence asn1Sequence = (ASN1Sequence)is.readObject();
            AlgorithmIdentifier algorithmIdentifier = AlgorithmIdentifier.getInstance( asn1Sequence.getObjectAt(0) );
            ASN1OctetString data = ASN1OctetString.getInstance( asn1Sequence.getObjectAt(1) );
            ASN1Sequence asn1Sequence2 = (ASN1Sequence)algorithmIdentifier.getParameters();
            DEROctetString salt = (DEROctetString)asn1Sequence2.getObjectAt( 0 );
            ASN1Integer ic = (ASN1Integer)asn1Sequence2.getObjectAt( 1 );
            PKCS5S1ParametersGenerator generator = new PKCS5S1ParametersGenerator( new SHA1Digest() );
            generator.init(
                    PBEParametersGenerator.PKCS5PasswordToBytes(privateKeyPassword.toCharArray())
                    , salt.getOctets()
                    , ic.getValue().intValue()
            );
            byte[] derivedKey = ((KeyParameter)generator.generateDerivedParameters(20*8)).getKey();
            byte[] keyData = new byte[ 16 ];
            System.arraycopy( derivedKey, 0, keyData, 0, 16 );
            byte[] digestBytes = new byte[ 4 ];
            System.arraycopy( derivedKey, 16, digestBytes, 0, 4 );
            MessageDigest md = MessageDigest.getInstance( "SHA-1" );
            md.reset();
            md.update( digestBytes );
            byte[] div = md.digest();
            byte[] iv = new byte[ 16 ];
            System.arraycopy( div, 0, iv, 0, 16 );
            IvParameterSpec ivSpec = new IvParameterSpec( iv );
            SecretKeySpec keySpec = new SecretKeySpec( keyData, "SEED" );
            Cipher cipher = Cipher.getInstance( "SEED/CBC/PKCS5Padding", "BC" );
            cipher.init( Cipher.DECRYPT_MODE, keySpec, ivSpec );
            byte[] decryptedKey = cipher.doFinal( data.getOctets() );
            return KeyFactory.getInstance( "RSA", "BC" )
                    .generatePrivate( new PKCS8EncodedKeySpec(decryptedKey) );
        }
    }

    private PublicKey readPublicKey() throws Exception {
        try( InputStream is = Files.newInputStream(Paths.get(publicKeyFile)) ) {
            return CertificateFactory.getInstance( "X.509" ).generateCertificate(is).getPublicKey();
        }
    }

    public String realtimeDecrypt( String encryptedData ) throws Exception {
        final PublicKey kotsaPublicKey = readPublicKey();
        final PrivateKey selfPrivateKey = readPrivateKey();
        List unpackedData = dataUnpacking( decode(encryptedData.getBytes()) );
        boolean verify = verify( kotsaPublicKey, (byte[]) unpackedData.get(3), (byte[]) unpackedData.get(2) );
        if( !verify ) throw new Exception( "전자서명 검증에 실패하였습니다." );
        SecretKey decryptedKey =
                new SecretKeySpec( decryptByPrivateKey(selfPrivateKey, (byte[]) unpackedData.get(0)), "SEED" );
        IvParameterSpec decryptedIv =
                new IvParameterSpec( decryptByPrivateKey(selfPrivateKey, (byte[]) unpackedData.get(1)) );
        return new String( decryptByKey(decryptedKey, decryptedIv, (byte[]) unpackedData.get(3)) );
    }

    public String realtimeEncrypt( String requestData ) throws Exception {
        final PublicKey kotsaPublicKey = readPublicKey();
        final PrivateKey selfPrivateKey = readPrivateKey();
        SecretKey key = generateKey();
        IvParameterSpec iv = generateIv();
        byte[] encryptedMessage = encryptByKey( key, iv, requestData );
        byte[] signedData = sign( selfPrivateKey, encryptedMessage );
        byte[] encryptedKey = encryptByPublicKey( kotsaPublicKey, key.getEncoded() );
        byte[] encryptedIv = encryptByPublicKey( kotsaPublicKey, iv.getIV() );
        byte[] packagedData = dataPacking( encryptedKey, encryptedIv, signedData, encryptedMessage );
        return new String( encode(packagedData) );
    }
}
